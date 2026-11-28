import { requestTask } from "@027apps/todo/domain/requests.js";
import { handle, json } from "@/lib/todo";

/** POST /api/v1/todo/tasks/{id}/requests — ask the holder for it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 20, windowSeconds: 3600, bucket: "todo-request" } }, async ({ todo, caller }) =>
    json({ request: await requestTask(todo, caller, id) }),
  );
}
