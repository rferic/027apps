import { listSeasons } from "@027apps/todo/domain/power.js";
import { handle, json } from "@/lib/todo";

/** GET /api/v1/todo/groups/{id}/seasons — the archive. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["power:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) =>
    json({ seasons: await listSeasons(todo, caller, id) }),
  );
}
