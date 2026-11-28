import { deleteTask, getTask, updateTask } from "@027apps/todo/domain/tasks.js";
import { updateTaskSchema } from "@027apps/todo/domain/schemas.js";
import { handle, json } from "@/lib/todo";

/** GET /api/v1/todo/tasks/{id} */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) =>
    json({ task: await getTask(todo, caller, id) }),
  );
}

/** PATCH /api/v1/todo/tasks/{id} — free: any member; held: only its holder. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    req,
    { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 30 }, schema: updateTaskSchema },
    async ({ todo, caller, ctx }) => {
      const body = ctx.body as {
        title?: string;
        notes?: string | null;
        category_id?: string | null;
        power?: number | null;
        due_on?: string | null;
      };
      return json({
        task: await updateTask(todo, caller, id, {
          title: body.title,
          notes: body.notes === undefined ? undefined : body.notes,
          categoryId: body.category_id === undefined ? undefined : body.category_id,
          power: body.power === undefined ? undefined : body.power,
          dueOn: body.due_on === undefined ? undefined : body.due_on,
        }),
      });
    },
  );
}

/** DELETE /api/v1/todo/tasks/{id} — only while pending. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 30 } }, async ({ todo, caller }) => {
    await deleteTask(todo, caller, id);
    return json({ deleted: true });
  });
}
