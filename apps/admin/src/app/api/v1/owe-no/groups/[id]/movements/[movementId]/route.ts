import { withDoor } from "@027apps/core/api/door.js";
import { deleteMovement, updateMovement } from "@027apps/owe-no/domain/service.js";
import { createMovementSchema } from "@027apps/owe-no/domain/requests.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** PATCH /api/v1/owe-no/groups/{id}/movements/{movementId} — author or creator. */
export async function PATCH(
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
      schema: createMovementSchema,
      rateLimit: { identity: "user", limit: 120 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as {
          kind: "expense" | "settlement";
          description: string;
          amount_minor: number;
          occurred_on: string;
          paid_by: string;
          category_id?: string | null;
          participants: Array<{ member_id: string; amount_minor?: number }>;
        };
        await updateMovement(owe, callerId(ctx.caller), id, movementId, {
          kind: body.kind,
          description: body.description,
          amount_minor: body.amount_minor,
          occurred_on: body.occurred_on,
          paid_by: body.paid_by,
          category_id: body.category_id ?? null,
          participants: body.participants.map((participant) => ({
            memberId: participant.member_id,
            ...(participant.amount_minor === undefined
              ? {}
              : { amount_minor: participant.amount_minor }),
          })),
        });
        return { status: 204, body: null };
      } catch (error) {
        domainError(error);
      }
    },
  );
}

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
