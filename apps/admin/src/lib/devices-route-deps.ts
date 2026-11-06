import { getInfra } from "@/lib/api/door";
import type { DevicesRouteDeps } from "@027apps/core/devices/api.js";

type Db = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * Drops the user's Supabase refresh sessions. Access JWTs already issued stay
 * valid at most their 15-minute lifetime; the device is soft-revoked first.
 */
function revokeSessions(db: Db) {
  return async (userId: string): Promise<void> => {
    await db.query("delete from auth.sessions where user_id = $1", [userId]);
  };
}

/** Shared device route dependencies: door, caller resolver and DB port. */
export async function devicesRouteDeps(): Promise<DevicesRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    devices: {
      db: settingsDeps.db,
      revokeSessions: revokeSessions(settingsDeps.db),
    },
  };
}
