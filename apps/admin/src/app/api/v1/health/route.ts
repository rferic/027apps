import { healthRoute } from "@027apps/core/instance/api.js";
import { CORE_VERSION } from "@027apps/core/version.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/health — public door (rate limit 30/min by IP), 30 s cache. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return healthRoute({ door: deps, auth, settings: settingsDeps, version: CORE_VERSION })(req);
}
