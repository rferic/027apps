import { z } from "zod";
import { cookies } from "next/headers";
import { withDoor, getInfra, withTransactionClient } from "@/lib/api/door";
import { EXPECTED_JWT_EXPIRY_SECONDS, jwtExpirySeconds } from "@027apps/core/auth/jwt.js";
import { recordJwtExpiry } from "@027apps/core/settings/service.js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFirstSuperAdmin } from "@027apps/core/auth/setup.js";
import { SMTP_COOKIE } from "@/app/setup/smtp-cookie";

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
                const { data, error } = await adminClient.auth.admin.createUser({
                  email,
                  password,
                  email_confirm: true,
                });
                if (error || !data.user) {
                  throw new Error(`createUser failed: ${error?.message}`);
                }
                return { userId: data.user.id };
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
