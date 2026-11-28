import { listCategories } from "@027apps/todo/domain/categories.js";
import { handle, json } from "@/lib/todo";

/** GET /api/v1/todo/categories — the instance catalog every group shares. */
export async function GET(req: Request) {
  return handle(req, { scopes: ["tasks:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo }) =>
    json({ categories: await listCategories(todo) }),
  );
}
