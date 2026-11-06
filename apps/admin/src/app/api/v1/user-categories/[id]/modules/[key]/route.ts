import {
  assignCategoryModuleRoute,
  unassignCategoryModuleRoute,
} from "@027apps/core/user-categories/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

function categories(deps: Awaited<ReturnType<typeof getInfra>>["settingsDeps"]) {
  return { db: deps.db, withTransaction: withTransactionClient };
}

/** POST/DELETE /api/v1/user-categories/{id}/modules/{key}. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return assignCategoryModuleRoute({ door: deps, auth, categories: categories(settingsDeps) })(
    req,
    id,
    key,
  );
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return unassignCategoryModuleRoute({ door: deps, auth, categories: categories(settingsDeps) })(
    req,
    id,
    key,
  );
}
