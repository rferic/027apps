import { closeSeason } from "@027apps/todo/domain/power.js";
import { handle, json } from "@/lib/todo";

/** POST /api/v1/todo/groups/{id}/season/close — archive the ranking and reset. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["groups:write"], rateLimit: { identity: "user", limit: 5, windowSeconds: 3600, bucket: "todo-season-close" } }, async ({ todo, caller }) =>
    json({ board: await closeSeason(todo, caller, id) }),
  );
}
