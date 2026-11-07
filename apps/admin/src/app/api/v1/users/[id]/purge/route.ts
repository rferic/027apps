import { purgeUserRoute } from "@027apps/core/users/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

/** DELETE /api/v1/users/{id}/purge — irreversible physical deletion. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return purgeUserRoute({ door: deps, auth, users: { db: settingsDeps.db, withTransaction: withTransactionClient } })(req, id);
}
