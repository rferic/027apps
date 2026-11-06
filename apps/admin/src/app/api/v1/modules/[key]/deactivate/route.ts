import { deactivateModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST /api/v1/modules/{key}/deactivate — active → disabled (DDL stays). */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return deactivateModuleRoute(await modulesRouteDeps())(req, key);
}
