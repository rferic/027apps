import { z } from "zod";
import { cookies } from "next/headers";
import { withDoor, getInfra, withTransactionClient } from "@/lib/api/door";
import { EXPECTED_JWT_EXPIRY_SECONDS, jwtExpirySeconds } from "@027apps/core/auth/jwt.js";
import { hasActiveSuperAdmin } from "@027apps/core/instance/api.js";
import { DomainError } from "@027apps/core/errors.js";
import { recordJwtExpiry } from "@027apps/core/settings/service.js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFirstSuperAdmin } from "@027apps/core/auth/setup.js";
import { SMTP_COOKIE } from "@/app/setup/smtp-cookie";
import { isRecoverableOrphan } from "@/lib/setup-orphan";

/**
 * POST /api/v1/setup/super-admin: atomic creation of the first super_admin.
 * Public door (rate limited by IP 30/min). Once setup is done it responds
 * 409 `already_setup` without leaking any data.
 */
const bodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(12),
    display_name: z.string().min(1).max(80),
  })
  .strict();

/** Auth user with that email, plus whether it already has a profile. */
async function findAuthUser(
  db: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> },
  email: string,
): Promise<{ id: string; hasProfile: boolean } | null> {
  const { rows } = await db.query(
    `select u.id, p.id as profile_id
       from auth.users u
       left join public.profiles p on p.id = u.id
      where u.email = $1
      limit 1`,
    [email],
  );
  const row = rows[0];
  return row ? { id: String(row.id), hasProfile: row.profile_id !== null } : null;
}


/** Creates the Auth user, recovering from an orphan left by a failed install. */
async function createUserWithOrphanRecovery(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  settingsDeps: Awaited<ReturnType<typeof getInfra>>["settingsDeps"],
  email: string,
  password: string,
): Promise<{ userId: string }> {
  const created = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error && created.data.user) return { userId: created.data.user.id };
  if (!created.error) throw new Error("createUser failed: no user returned");
  if (!/already been registered/i.test(created.error.message)) {
    throw new Error(`createUser failed: ${created.error.message}`);
  }

  const existing = await findAuthUser(settingsDeps.db, email);
  const setupOpen = !(await hasActiveSuperAdmin(settingsDeps));
  if (!existing || !isRecoverableOrphan(created.error.message, existing, setupOpen)) {
    throw new DomainError("conflict", "That email already belongs to an account. Use another email.");
  }

  await adminClient.auth.admin.deleteUser(existing.id);
  const retry = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (retry.error || !retry.data.user) {
    throw new Error(`createUser failed after orphan cleanup: ${retry.error?.message}`);
  }
  return { userId: retry.data.user.id };
}

export async function POST(req: Request) {
  const { deps, settingsDeps } = await getInfra();
  return withDoor(
    req,
    {
      scopes: [],
      auth: () => Promise.resolve({ kind: "anon" }),
      rateLimit: { identity: "ip", limit: 30 },
      schema: bodySchema,
    },
    deps,
    async (ctx) => {
      const body = ctx.body as { email: string; password: string; display_name: string };

      const adminClient = createSupabaseAdminClient();
      const serverClient = await createSupabaseServerClient();

      const { userId } = await withTransactionClient(async (db) => {
        return createFirstSuperAdmin(
          {
            auth: {
              async createUser(email: string, password: string) {
                return createUserWithOrphanRecovery(adminClient, settingsDeps, email, password);
              },
              async deleteUser(userId: string) {
                const { error } = await adminClient.auth.admin.deleteUser(userId);
                if (error) throw new Error(`deleteUser failed: ${error.message}`);
              },
            },
            db,
          },
          {
            email: body.email,
            password: body.password,
            displayName: body.display_name,
          },
        );
      });

      // Sign the user in so the browser gets the session cookies via the proxy.
      const { data, error: signInError } = await serverClient.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (signInError) {
        throw new Error(`signIn failed: ${signInError.message}`);
      }

      // A fresh install always starts at step 3: drop any SMTP confirmation
      // cookie left over from a previous run (cookies survive a db reset).
      (await cookies()).set(SMTP_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/setup",
        maxAge: 0,
      });

      // Step 2 verification (instance-config spec §7.2): record the token
      // lifetime the project actually issues; the wizard blocks until it is 900.
      const accessToken = data.session?.access_token;
      const jwtExpiry = accessToken ? jwtExpirySeconds(accessToken) : null;
      if (jwtExpiry !== null) await recordJwtExpiry(settingsDeps.db, userId, jwtExpiry);

      return {
        status: 201,
        body: {
          user: { id: userId, email: body.email },
          jwt_expiry: jwtExpiry,
          jwt_expiry_ok: jwtExpiry === EXPECTED_JWT_EXPIRY_SECONDS,
        },
      };
    },
  );
}
