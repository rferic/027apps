import { restoreUserRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

/** POST /api/v1/users/{id}/restore — undo a soft deactivation. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return restoreUserRoute({ door: deps, auth, users: { db: settingsDeps.db, withTransaction: withTransactionClient } })(req, id);
}
