import { moduleSettingsRoute, updateModuleSettingRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET/PATCH /api/v1/modules/{key}/panel/settings — admin-only module configuration. */
export async function GET(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return moduleSettingsRoute(await modulesRouteDeps())(req, key);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return updateModuleSettingRoute(await modulesRouteDeps())(req, key);
}
