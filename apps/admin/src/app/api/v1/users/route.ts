import { usersRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

/** GET /api/v1/users — list users (admins). */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return usersRoute({ door: deps, auth, users: { db: settingsDeps.db, withTransaction: withTransactionClient } })(req);
}
