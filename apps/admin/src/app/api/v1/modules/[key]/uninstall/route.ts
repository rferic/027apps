import { uninstallModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST /api/v1/modules/{key}/uninstall — reverse `down`, clean Core rows. */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return uninstallModuleRoute(await modulesRouteDeps())(req, key);
}
