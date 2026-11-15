import { withDoor } from "@027apps/core/api/door.js";
import { categoryNameSchema } from "@027apps/owe-no/domain/requests.js";
import { createCategory, listCategories } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/categories — names for the movement form. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["expenses:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => {
      try {
        return json({ categories: await listCategories(owe, callerId(ctx.caller), id) });
      } catch (error) {
        domainError(error);
      }
    },
  );
}

/** POST /api/v1/owe-no/groups/{id}/categories — any active member files one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: categoryNameSchema,
      rateLimit: { identity: "user", limit: 60 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as { name: string };
        const category = await createCategory(owe, callerId(ctx.caller), id, body.name);
        return { status: 201, body: json({ category }) };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
