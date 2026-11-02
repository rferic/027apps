import { instanceRoute } from "@027apps/core/instance/api.js";
import { CORE_VERSION } from "@027apps/core/version.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/instance — public door: version, setup state and public settings. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return instanceRoute({ door: deps, auth, settings: settingsDeps, version: CORE_VERSION })(req);
}
