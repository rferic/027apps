import { userModulesRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

/** GET /api/v1/users/{id}/modules — modules granted to the profile. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return userModulesRoute({
    door: deps,
    auth,
    users: { db: settingsDeps.db, withTransaction: withTransactionClient },
  })(req, id);
}
