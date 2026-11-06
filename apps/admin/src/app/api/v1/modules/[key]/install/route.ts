import { installModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST /api/v1/modules/{key}/install — apply the trusted packaged manifest. */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return installModuleRoute(await modulesRouteDeps())(req, key);
}
