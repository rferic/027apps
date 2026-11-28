import { ensurePersonalGroup, createGroup, listGroups } from "@027apps/todo/domain/groups.js";
import { createGroupSchema } from "@027apps/todo/domain/schemas.js";
import { handle, json, personalName, profileContext } from "@/lib/todo";

/** GET /api/v1/todo/groups — my groups, with the personal one created on demand. */
export async function GET(req: Request) {
  return handle(req, { scopes: ["groups:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) => {
    const { timezone, locale } = await profileContext(todo, caller.userId);
    await ensurePersonalGroup(todo, caller, { name: personalName(locale), timezone });
    return json({ groups: await listGroups(todo, caller) });
  });
}

/** POST /api/v1/todo/groups — anyone with the module creates a group. */
export async function POST(req: Request) {
  return handle(
    req,
    { scopes: ["groups:write"], rateLimit: { identity: "user", limit: 10, windowSeconds: 3600, bucket: "todo-group-create" }, schema: createGroupSchema },
    async ({ todo, caller, ctx }) => {
      const body = ctx.body as {
        name: string;
        timezone?: string;
        power_enabled?: boolean;
        power_period?: "infinite" | "weekly" | "monthly" | "yearly";
      };
      const { timezone } = await profileContext(todo, caller.userId);
      const group = await createGroup(todo, caller, {
        name: body.name,
        timezone: body.timezone ?? timezone,
        powerEnabled: body.power_enabled,
        powerPeriod: body.power_period,
      });
      return json({ group });
    },
  );
}
