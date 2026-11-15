import { getInfra, runInTransaction } from "@/lib/api/door";
import { outboxDepsFromSettings } from "@/lib/realtime";
import type { MaintenanceRouteDeps } from "@027apps/core/maintenance/api.js";

/** Shared maintenance dependencies: door, realtime/push ports and DB runner. */
export async function maintenanceRouteDeps(): Promise<MaintenanceRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();

  return {
    door: deps,
    auth,
    maintenance: {
      db: settingsDeps.db,
      withTransaction: runInTransaction,
      // The outbox relay is shared with the write hook, so both deliver the
      // same events with the same realtime and push ports.
      realtime: await outboxDepsFromSettings({
        db: settingsDeps.db,
        encryption: settingsDeps.encryption,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      }),
    },
  };
}
