import { createUserCategoryRoute, userCategoriesRoute } from "@027apps/core/user-categories/api.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";

function categories(deps: Awaited<ReturnType<typeof getInfra>>["settingsDeps"]) {
  return { db: deps.db, withTransaction: withTransactionClient };
}

/** GET/POST /api/v1/user-categories — list and create categories. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return userCategoriesRoute({ door: deps, auth, categories: categories(settingsDeps) })(req);
}

export async function POST(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return createUserCategoryRoute({ door: deps, auth, categories: categories(settingsDeps) })(req);
}
