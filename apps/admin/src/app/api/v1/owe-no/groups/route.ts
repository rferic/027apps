import { withDoor } from "@027apps/core/api/door.js";
import { createGroupSchema } from "@027apps/owe-no/domain/requests.js";
import { createGroup, listGroups } from "@027apps/owe-no/domain/service.js";
import { domainError, json, oweDeps } from "@/lib/owe-no";

/** GET /api/v1/owe-no/groups — the groups this caller belongs to. */
export async function GET(req: Request) {
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    { scopes: ["expenses:read"], moduleKey: "owe-no", auth, rateLimit: { identity: "user", limit: 120 } },
    door,
    async (ctx) => ({ groups: json(await listGroups(owe, callerId(ctx.caller))) }),
  );
}

/** POST /api/v1/owe-no/groups — anyone with the module creates a group. */
export async function POST(req: Request) {
  const { door, auth, owe, callerId } = await oweDeps();
  return withDoor(
    req,
    {
      scopes: ["expenses:read_write"],
      moduleKey: "owe-no",
      auth,
      schema: createGroupSchema,
      rateLimit: { identity: "user", limit: 60 },
    },
    door,
    async (ctx) => {
      try {
        const body = ctx.body as { name: string; currency: string };
        const group = await createGroup(owe, callerId(ctx.caller), body);
        return { status: 201, body: json({ group }) };
      } catch (error) {
        domainError(error);
      }
    },
  );
}
