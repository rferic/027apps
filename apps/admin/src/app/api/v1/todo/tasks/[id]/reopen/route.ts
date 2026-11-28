import { reopenTask } from "@027apps/todo/domain/requests.js";
import { handle, json } from "@/lib/todo";

/** POST /api/v1/todo/tasks/{id}/reopen — undo, only inside the open season. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 10 } }, async ({ todo, caller }) =>
    json({ task: await reopenTask(todo, caller, id) }),
  );
}
