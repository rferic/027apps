import { withDoor } from "@027apps/core/api/door.js";
import { DomainError } from "@027apps/core/errors.js";
import { groupSummary } from "@027apps/owe-no/domain/summary.js";
import { listGroups } from "@027apps/owe-no/domain/service.js";
import { json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups/{id}/summary — the app's month and history view. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read"],
      moduleKey: "owe-no",
      auth,
      rateLimit: { identity: "user", limit: 120 },
    },
    door,
    async (ctx) => {
      const userId = callerId(ctx.caller);
      const group = (await listGroups(owe, userId)).find((candidate) => candidate.id === id);
      if (!group) throw new DomainError("not_found");
      return json({ summary: await groupSummary(owe, id) });
    },
  );
}
