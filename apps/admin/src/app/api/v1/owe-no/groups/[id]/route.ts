import { withDoor } from "@027apps/core/api/door.js";
import { listGroups, listMembers } from "@027apps/owe-no/domain/service.js";
import { json, oweDeps } from "@/lib/owe-no";
import { DomainError } from "@027apps/core/errors.js";

/** GET /api/v1/owe-no/groups/{id} — the group and its members. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["expenses:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => {
      const userId = callerId(ctx.caller);
      const group = (await listGroups(owe, userId)).find((candidate) => candidate.id === id);
      if (!group) throw new DomainError("not_found");
      return json({ group, members: await listMembers(owe, userId, id) });
    },
  );
}
