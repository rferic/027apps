import { maintenanceStatusRoute } from "@027apps/core/maintenance/api.js";
import { maintenanceRouteDeps } from "@/lib/maintenance-route-deps";

/** GET /api/v1/maintenance/status — last runs and outbox counters. */
export async function GET(req: Request) {
  return maintenanceStatusRoute(await maintenanceRouteDeps())(req);
}
