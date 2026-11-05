import { translationsRoute } from "@027apps/core/i18n/api.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/translations?locale=xx — authenticated, enabled locales, ETag. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return translationsRoute({ door: deps, auth, settings: settingsDeps })(req);
}
