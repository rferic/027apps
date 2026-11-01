import { patchSettingRoute } from "@027apps/core/settings/api.js";
import { deps, auth, settingsDeps } from "@/lib/api/door";

const handler = patchSettingRoute({ door: deps, auth, settings: settingsDeps });

/** PATCH /api/v1/settings/{category}/{key} — value only, admin/super_admin rules. */
export async function PATCH(req: Request, ctx: { params: Promise<{ category: string; key: string }> }) {
  const { category, key } = await ctx.params;
  return handler(req, `${category}.${key}`);
}
