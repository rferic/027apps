import { patchSettingRoute } from "@027apps/core/settings/api.js";
import { getInfra } from "@/lib/api/door";

/** PATCH /api/v1/settings/{category}/{key} — value only, admin/super_admin rules. */
export async function PATCH(req: Request, ctx: { params: Promise<{ category: string; key: string }> }) {
  const { category, key } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return patchSettingRoute({ door: deps, auth, settings: settingsDeps })(req, `${category}.${key}`);
}
