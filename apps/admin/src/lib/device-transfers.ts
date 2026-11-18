import type { DeviceTransfersAuth } from "@027apps/core/devices/transfers.js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Db = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * Supabase Auth adapter for phone migration: the email of the profile's Auth
 * user and a magic-link hash. The hash is the only thing that leaves Supabase;
 * the app verifies it with `verifyOtp` and never receives a session from us.
 */
export function createDeviceTransfersAuth(db: Db): DeviceTransfersAuth {
  const admin = createSupabaseAdminClient();

  return {
    async getUserEmail(userId) {
      const { rows } = await db.query("select email from auth.users where id = $1", [userId]);
      const email = rows[0]?.email;
      return typeof email === "string" && email.length > 0 ? email : null;
    },

    async createMagicLink(email) {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      const tokenHash = data?.properties?.hashed_token;
      if (error || !tokenHash) throw new Error("magic link failed");
      return { tokenHash };
    },
  };
}
