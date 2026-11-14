import { mePatchRoute, meRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

/** GET /api/v1/me — the signed-in caller's profile (also a delegated key's). */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return meRoute({
    door: deps,
    auth,
    users: { db: settingsDeps.db, withTransaction: withTransactionClient },
  })(req);
}

/** PATCH /api/v1/me — display name, locale and theme of the caller's profile. */
export async function PATCH(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return mePatchRoute({
    door: deps,
    auth,
    users: { db: settingsDeps.db, withTransaction: withTransactionClient },
  })(req);
}
