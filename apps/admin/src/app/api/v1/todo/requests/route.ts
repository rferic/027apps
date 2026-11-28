import { listRequests } from "@027apps/todo/domain/requests.js";
import { requestQuerySchema } from "@027apps/todo/domain/schemas.js";
import { handle, json, parseQuery } from "@/lib/todo";

/** GET /api/v1/todo/requests?direction=incoming|outgoing — the inbox. */
export async function GET(req: Request) {
  return handle(req, { scopes: ["tasks:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) => {
    const { direction } = parseQuery(requestQuerySchema, req);
    return json({ requests: await listRequests(todo, caller, direction) });
  });
}
