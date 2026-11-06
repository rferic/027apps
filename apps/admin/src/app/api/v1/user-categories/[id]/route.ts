import {
  deleteUserCategoryRoute,
  renameUserCategoryRoute,
  userCategoryRoute,
} from "@027apps/core/user-categories/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

function categories(deps: Awaited<ReturnType<typeof getInfra>>["settingsDeps"]) {
  return { db: deps.db, withTransaction: withTransactionClient };
}

/** GET/PATCH/DELETE /api/v1/user-categories/{id}. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return userCategoryRoute({ door: deps, auth, categories: categories(settingsDeps) })(req, id);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return renameUserCategoryRoute({ door: deps, auth, categories: categories(settingsDeps) })(req, id);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return deleteUserCategoryRoute({ door: deps, auth, categories: categories(settingsDeps) })(req, id);
}
