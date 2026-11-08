import { moduleGrantsRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET /api/v1/modules/{key}/grants — who currently has the module (admin only). */
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return moduleGrantsRoute(await modulesRouteDeps())(req, key);
}
