import {
  addCategoryMemberRoute,
  removeCategoryMemberRoute,
} from "@027apps/core/user-categories/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

function categories(deps: Awaited<ReturnType<typeof getInfra>>["settingsDeps"]) {
  return { db: deps.db, withTransaction: withTransactionClient };
}

/** POST/DELETE /api/v1/user-categories/{id}/members/{userId}. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return addCategoryMemberRoute({ door: deps, auth, categories: categories(settingsDeps) })(
    req,
    id,
    userId,
  );
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await ctx.params;
  const { deps, auth, settingsDeps } = await getInfra();
  return removeCategoryMemberRoute({ door: deps, auth, categories: categories(settingsDeps) })(
    req,
    id,
    userId,
  );
}
