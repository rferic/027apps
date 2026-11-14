import { withDoor } from "@027apps/core/api/door.js";
import { declineInvitation } from "@027apps/owe-no/domain/service.js";
import { domainError, oweDeps } from "@/lib/owe-no";

/** POST /api/v1/owe-no/groups/{id}/members/decline — the invitee declines. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 20 },
    },
    door,
    async (ctx) => {
      try {
        await declineInvitation(owe, callerId(ctx.caller), id);
        return { status: 204, body: null };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
