import { withDoor } from "@027apps/core/api/door.js";
import { listCategories } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/categories — names for the movement form. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 60 },
    },
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
