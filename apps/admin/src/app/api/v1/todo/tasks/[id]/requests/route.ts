import { requestTask } from "@027apps/todo/domain/requests.js";
import { withIdempotency } from "@027apps/todo/domain/idempotency.js";
import { handle, idempotencyKey, json } from "@/lib/todo";

/** POST /api/v1/todo/tasks/{id}/requests — ask the holder for it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    req,
    { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 20, windowSeconds: 3600, bucket: "todo-request" } },
    async ({ todo, caller }) => {
      const request = await withIdempotency(
        todo,
        caller,
        { key: idempotencyKey(req), endpoint: `POST /tasks/${id}/requests` },
        (scoped) => requestTask(scoped, caller, id),
      );
      return json({ request });
    },
  );
}
