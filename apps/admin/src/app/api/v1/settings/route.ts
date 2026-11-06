import { settingsRoute, patchSettingsRoute } from "@027apps/core/settings/api.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/settings — admin only; secrets masked as configured. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return settingsRoute({ door: deps, auth, settings: settingsDeps })(req);
}

/** PATCH /api/v1/settings — batch write settings in a single atomic transaction. */
export async function PATCH(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return patchSettingsRoute({ door: deps, auth, settings: settingsDeps })(req);
}
