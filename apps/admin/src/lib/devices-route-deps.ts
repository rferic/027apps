import { getInfra, withTransactionClient } from "@/lib/api/door";
import { createDeviceTransfersAuth } from "@/lib/device-transfers";
import { revokeSessions } from "@/lib/session-revocation";
import type { DevicesRouteDeps } from "@027apps/core/devices/api.js";

/** Shared device route dependencies: door, caller resolver, DB and Auth ports. */
export async function devicesRouteDeps(): Promise<DevicesRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    devices: {
      db: settingsDeps.db,
      revokeSessions: revokeSessions(settingsDeps.db),
    },
    transfers: {
      db: settingsDeps.db,
      withTransaction: withTransactionClient,
      auth: createDeviceTransfersAuth(settingsDeps.db),
    },
  };
}
