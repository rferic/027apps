import { withDoor } from "@027apps/core/api/door.js";
import { acceptInvitation } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** POST /api/v1/owe-no/groups/{id}/members/accept — the invitee joins. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 60 },
    },
    door,
    async (ctx) => {
      try {
        await acceptInvitation(owe, callerId(ctx.caller), id);
        return { status: 204, body: null };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
