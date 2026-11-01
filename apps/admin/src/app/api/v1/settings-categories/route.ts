import { settingsCategoriesRoute } from "@027apps/core/settings/api.js";
import { deps, auth, settingsDeps } from "@/lib/api/door";

/** GET /api/v1/settings-categories — admin only, grouped by sort order. */
export const GET = settingsCategoriesRoute({ door: deps, auth, settings: settingsDeps });
