import { maintenanceRunRoute } from "@027apps/core/maintenance/api.js";
import { maintenanceRouteDeps } from "@/lib/maintenance-route-deps";

/** POST /api/v1/maintenance/run — leased jobs for the instance service key. */
export async function POST(req: Request) {
  return maintenanceRunRoute(await maintenanceRouteDeps())(req);
}
