import { withDoor } from "@027apps/core/api/door.js";
import { removeMember } from "@027apps/owe-no/domain/service.js";
import { domainError, oweDeps } from "@/lib/owe-no";

/** DELETE /api/v1/owe-no/groups/{id}/members/{memberId} — the creator removes. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 30 },
    },
    door,
    async (ctx) => {
      try {
        const mode =
          new URL(req.url).searchParams.get("mode") === "ghost" ? "ghost" : "settle";
        await removeMember(owe, callerId(ctx.caller), id, memberId, mode);
        return { status: 204, body: null };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
