import { withDoor } from "@027apps/core/api/door.js";
import { balances, listMembers } from "@027apps/owe-no/domain/service.js";
import { json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/balances — paid minus owed per member. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["balances:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => {
      const userId = callerId(ctx.caller);
      const members = await listMembers(owe, userId, id);
      const current = await balances(owe, userId, id);
      return json({
        balances: members.map((member) => ({
          member_id: member.id,
          display_name: member.display_name,
          amount_minor: current.get(member.id) ?? 0,
        })),
      });
    },
  );
}
