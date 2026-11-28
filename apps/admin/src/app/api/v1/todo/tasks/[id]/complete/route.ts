import { completeTask } from "@027apps/todo/domain/tasks.js";
import { handle, json } from "@/lib/todo";

/** POST /api/v1/todo/tasks/{id}/complete — only its holder. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 30 } }, async ({ todo, caller }) =>
    json({ task: await completeTask(todo, caller, id) }),
  );
}
