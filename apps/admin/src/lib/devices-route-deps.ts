import { getInfra } from "@/lib/api/door";
import { revokeSessions } from "@/lib/session-revocation";
import type { DevicesRouteDeps } from "@027apps/core/devices/api.js";

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
