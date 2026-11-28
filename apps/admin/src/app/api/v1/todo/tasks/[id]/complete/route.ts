import { completeTask } from "@027apps/todo/domain/tasks.js";
import { withIdempotency } from "@027apps/todo/domain/idempotency.js";
import { handle, idempotencyKey, json } from "@/lib/todo";

/** POST /api/v1/todo/tasks/{id}/complete — only its holder. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 30 } }, async ({ todo, caller }) => {
    const task = await withIdempotency(
      todo,
      caller,
      { key: idempotencyKey(req), endpoint: `POST /tasks/${id}/complete` },
      (scoped) => completeTask(scoped, caller, id),
    );
    return json({ task });
  });
}
