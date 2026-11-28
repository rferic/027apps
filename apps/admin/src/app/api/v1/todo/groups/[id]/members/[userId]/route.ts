import { removeMember } from "@027apps/todo/domain/groups.js";
import { handle, json } from "@/lib/todo";

/** DELETE /api/v1/todo/groups/{id}/members/{userId} — frees their tasks. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  return handle(req, { scopes: ["groups:write"], rateLimit: { identity: "user", limit: 30 } }, async ({ todo, caller }) =>
    json({ members: await removeMember(todo, caller, id, userId) }),
  );
}
