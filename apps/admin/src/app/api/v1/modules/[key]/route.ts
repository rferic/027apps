import { moduleRoute, updateModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET/PATCH /api/v1/modules/{key} — detail and visibility/MCP exposure. */
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return moduleRoute(await modulesRouteDeps())(req, key);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return updateModuleRoute(await modulesRouteDeps())(req, key);
}
