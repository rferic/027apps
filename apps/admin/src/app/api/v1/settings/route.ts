import { settingsRoute } from "@027apps/core/settings/api.js";
import { deps, auth, settingsDeps } from "@/lib/api/door";

/** GET /api/v1/settings — admin only; secrets masked as configured. */
export const GET = settingsRoute({ door: deps, auth, settings: settingsDeps });
