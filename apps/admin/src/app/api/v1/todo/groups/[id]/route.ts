import { deleteGroup, getGroup, listMembers, updateGroup } from "@027apps/todo/domain/groups.js";
import { updateGroupSchema } from "@027apps/todo/domain/schemas.js";
import { handle, json } from "@/lib/todo";

/** GET /api/v1/todo/groups/{id} — the group and its members. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["groups:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) =>
    json({ group: await getGroup(todo, caller, id), members: await listMembers(todo, caller, id) }),
  );
}

/** PATCH /api/v1/todo/groups/{id} — the owner renames it or configures power. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    req,
    { scopes: ["groups:write"], rateLimit: { identity: "user", limit: 30 }, schema: updateGroupSchema },
    async ({ todo, caller, ctx }) => {
      const body = ctx.body as {
        name?: string;
        timezone?: string;
        power_enabled?: boolean;
        power_period?: "infinite" | "weekly" | "monthly" | "yearly";
      };
      return json({
        group: await updateGroup(todo, caller, id, {
          name: body.name,
          timezone: body.timezone,
          powerEnabled: body.power_enabled,
          powerPeriod: body.power_period,
        }),
      });
    },
  );
}

/** DELETE /api/v1/todo/groups/{id} — the owner drops a shared group. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["groups:write"], rateLimit: { identity: "user", limit: 10 } }, async ({ todo, caller }) => {
    await deleteGroup(todo, caller, id);
    return json({ deleted: true });
  });
}
