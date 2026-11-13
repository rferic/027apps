import { myModulesRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET /api/v1/me/modules — the modules the signed-in caller can open. */
export async function GET(req: Request) {
  return myModulesRoute(await modulesRouteDeps())(req);
}
