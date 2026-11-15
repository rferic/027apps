import { withDoor } from "@027apps/core/api/door.js";
import { categoryUpdateSchema } from "@027apps/owe-no/domain/requests.js";
import { archiveCategory, renameCategory } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** PATCH /api/v1/owe-no/groups/{id}/categories/{categoryId} — rename or archive. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> },
) {
  const { id, categoryId } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: categoryUpdateSchema,
      rateLimit: { identity: "user", limit: 60 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as { name?: string; archived?: boolean };
        const caller = callerId(ctx.caller);
        let category = body.name !== undefined
          ? await renameCategory(owe, caller, id, categoryId, body.name)
          : undefined;
        if (body.archived !== undefined) {
          category = await archiveCategory(owe, caller, id, categoryId, body.archived);
        }
        return json({ category });
      } catch (error) {
        domainError(error);
      }
    },
  );
}
