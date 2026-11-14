import { withDoor } from "@027apps/core/api/door.js";
import { z } from "zod";
import { linkMember } from "@027apps/owe-no/domain/service.js";
import { domainError, oweDeps } from "@/lib/owe-no";

const linkSchema = z.object({ user_id: z.uuid() }).strict();

/** POST /api/v1/owe-no/groups/{id}/members/{memberId}/link — admin links a fictitious member. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  const { door, auth, owe } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: linkSchema,
      rateLimit: { identity: "user", limit: 30 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as { user_id: string };
        await linkMember(owe, id, memberId, body.user_id);
        return { status: 204, body: null };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
