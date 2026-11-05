import { getInfra, runInTransaction } from "@/lib/api/door";
import { createBroadcastPort, createPushFromSettings } from "@/lib/realtime";
import type { MaintenanceRouteDeps } from "@027apps/core/maintenance/api.js";

/** Shared maintenance dependencies: door, realtime/push ports and DB runner. */
export async function maintenanceRouteDeps(): Promise<MaintenanceRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    door: deps,
    auth,
    maintenance: {
      db: settingsDeps.db,
      withTransaction: runInTransaction,
      realtime: {
        db: settingsDeps.db,
        ...(url && serviceKey ? { realtime: createBroadcastPort(url, serviceKey) } : {}),
        push: await createPushFromSettings(settingsDeps.db, settingsDeps.encryption),
      },
    },
  };
}
