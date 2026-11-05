import { activateModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST /api/v1/modules/{key}/activate — installed|disabled → active. */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return activateModuleRoute(await modulesRouteDeps())(req, key);
}
