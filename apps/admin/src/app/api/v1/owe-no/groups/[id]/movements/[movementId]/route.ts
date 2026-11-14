import { withDoor } from "@027apps/core/api/door.js";
import { deleteMovement } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** DELETE /api/v1/owe-no/groups/{id}/movements/{movementId} — soft delete. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; movementId: string }> },
) {
  const { id, movementId } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 120 },
    },
    door,
    async (ctx) => {
      try {
        await deleteMovement(owe, callerId(ctx.caller), id, movementId);
        return { status: 204, body: null };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
