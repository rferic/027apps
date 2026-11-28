import { addMember, listMembers } from "@027apps/todo/domain/groups.js";
import { addMemberSchema } from "@027apps/todo/domain/schemas.js";
import { handle, json } from "@/lib/todo";

/** GET /api/v1/todo/groups/{id}/members */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["groups:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) =>
    json({ members: await listMembers(todo, caller, id) }),
  );
}

/** POST /api/v1/todo/groups/{id}/members — the owner adds somebody. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    req,
    { scopes: ["groups:write"], rateLimit: { identity: "user", limit: 30 }, schema: addMemberSchema },
    async ({ todo, caller, ctx }) => {
      const { user_id } = ctx.body as { user_id: string };
      return json({ members: await addMember(todo, caller, id, user_id) });
    },
  );
}
