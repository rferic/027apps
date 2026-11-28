import { acceptRequest } from "@027apps/todo/domain/requests.js";
import { handle, json } from "@/lib/todo";

/** POST /api/v1/todo/requests/{id}/accept — the holder hands the task over. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 30 } }, async ({ todo, caller }) =>
    json({ request: await acceptRequest(todo, caller, id) }),
  );
}
