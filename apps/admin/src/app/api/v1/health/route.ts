import { healthRoute } from "@027apps/core/instance/api.js";
import { CORE_VERSION } from "@027apps/core/version.js";
import { deps, auth, settingsDeps } from "@/lib/api/door";

/** GET /api/v1/health — public door (rate limit 30/min by IP), 30 s cache. */
export const GET = healthRoute({ door: deps, auth, settings: settingsDeps, version: CORE_VERSION });
