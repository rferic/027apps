import { settingsRoute } from "@027apps/core/settings/api.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/settings — admin only; secrets masked as configured. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return settingsRoute({ door: deps, auth, settings: settingsDeps })(req);
}
