import { dashboardRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET /api/v1/me/dashboard — widgets of the modules the caller can use. */
export async function GET(req: Request) {
  return dashboardRoute(await modulesRouteDeps())(req);
}
