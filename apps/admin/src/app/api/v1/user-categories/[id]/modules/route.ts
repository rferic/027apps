import { categoryModulesRoute } from "@027apps/core/user-categories/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

function categories(deps: Awaited<ReturnType<typeof getInfra>>["settingsDeps"]) {
  return { db: deps.db, withTransaction: withTransactionClient };
}

/** GET /api/v1/user-categories/{id}/modules — bulk template. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return categoryModulesRoute({ door: deps, auth, categories: categories(settingsDeps) })(req, id);
}
