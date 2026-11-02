import { settingsCategoriesRoute } from "@027apps/core/settings/api.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/settings-categories — admin only, grouped by sort order. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return settingsCategoriesRoute({ door: deps, auth, settings: settingsDeps })(req);
}
