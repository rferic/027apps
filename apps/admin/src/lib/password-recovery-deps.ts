import type { PasswordRecoveryDeps } from "@027apps/core/auth/password-recovery.js";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { getInfra } from "@/lib/api/door";
import { createRecoveryMailer } from "@/lib/email/recovery-mailer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Production dependencies for the recovery service: DB, Auth admin, Resend. */
export async function passwordRecoveryDeps(): Promise<PasswordRecoveryDeps> {
  const { settingsDeps, deps } = await getInfra();
  const settings = await readPublicSettings(settingsDeps);
  const publicUrl = readString(settings["instance.public_url"]);
  const instanceName = readString(settings["instance.name"]) ?? "027Apps";
  const admin = createSupabaseAdminClient();
  const db = settingsDeps.db;

  return {
    db,
    rateLimit: deps.rateLimitStorage,
    // An instance without a public URL cannot send a usable link; the empty
    // base makes the mailer skip it rather than send a broken one.
    publicUrl: publicUrl ?? "",
    instanceName,
    auth: {
      async findUserByEmail(email) {
        const { rows } = await db.query(
          "select id from auth.users where email = $1 limit 1",
          [email],
        );
        return rows[0] ? { id: String(rows[0].id) } : null;
      },
      async generateRecoveryLink(email) {
        const { data, error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        const tokenHash = data?.properties?.hashed_token;
        if (error || !tokenHash) throw new Error("recovery link failed");
        return { tokenHash };
      },
    },
    mailer: createRecoveryMailer(),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    floorMs: 700,
  };
}
