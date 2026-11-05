import { modulesRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET /api/v1/modules — the instance module catalogue. */
export async function GET(req: Request) {
  return modulesRoute(await modulesRouteDeps())(req);
}
