import { withDoor } from "@027apps/core/api/door.js";
import { addMemberSchema } from "@027apps/owe-no/domain/requests.js";
import { addMember, listMembers } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/members — members of a group. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["expenses:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => ({ members: json(await listMembers(owe, callerId(ctx.caller), id)) }),
  );
}

/** POST /api/v1/owe-no/groups/{id}/members — invite or add a fictitious member. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: addMemberSchema,
      rateLimit: { identity: "user", limit: 60 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as { display_name: string; invitee_id?: string; active?: boolean };
        const member = await addMember(owe, callerId(ctx.caller), id, {
          displayName: body.display_name,
          ...(body.invitee_id ? { inviteeId: body.invitee_id } : {}),
          ...(body.active ? { active: true } : {}),
        });
        return { status: 201, body: json({ member }) };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
