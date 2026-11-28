import { getSeason } from "@027apps/todo/domain/power.js";
import { handle, json } from "@/lib/todo";

/** GET /api/v1/todo/groups/{id}/seasons/{number} — one archived ranking. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  const { id, number } = await params;
  const season = Number(number);
  return handle(req, { scopes: ["power:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) =>
    json({ season: await getSeason(todo, caller, id, Number.isInteger(season) ? season : -1) }),
  );
}
