import { withDoor } from "@027apps/core/api/door.js";
import { createMovementSchema } from "@027apps/owe-no/domain/requests.js";
import { addMovement, listMovements } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/movements — history without deleted rows. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["expenses:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => ({ movements: json(await listMovements(owe, callerId(ctx.caller), id)) }),
  );
}

/** POST /api/v1/owe-no/groups/{id}/movements — an expense or a settlement. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        const movement = await addMovement(owe, callerId(ctx.caller), id, {
          kind: body.kind,
          description: body.description,
          amount_minor: body.amount_minor,
          occurred_on: body.occurred_on,
          paid_by: body.paid_by,
          ...(body.category_id === undefined ? {} : { category_id: body.category_id }),
          participants: body.participants.map((share) => ({
            memberId: share.member_id,
            ...(share.amount_minor === undefined ? {} : { amount_minor: share.amount_minor }),
          })),
        });
        return { status: 201, body: json({ movement }) };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
