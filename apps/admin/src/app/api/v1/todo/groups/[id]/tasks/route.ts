import { createTask, listTasks } from "@027apps/todo/domain/tasks.js";
import { createTaskSchema, taskQuerySchema } from "@027apps/todo/domain/schemas.js";
import { withIdempotency } from "@027apps/todo/domain/idempotency.js";
import { handle, idempotencyKey, json, parseQuery } from "@/lib/todo";

/** GET /api/v1/todo/groups/{id}/tasks — filters and a cursor. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(req, { scopes: ["tasks:read"], rateLimit: { identity: "user", limit: 120 } }, async ({ todo, caller }) => {
    const query = parseQuery(taskQuerySchema, req);
    const page = await listTasks(todo, caller, id, {
      state: query.state,
      categoryId: query.category,
      mine: query.assignee === "me",
      overdue: query.overdue !== undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
    return json(page);
  });
}

/** POST /api/v1/todo/groups/{id}/tasks — a post-it in this group. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    req,
    { scopes: ["tasks:write"], rateLimit: { identity: "user", limit: 30 }, schema: createTaskSchema, moduleSettings: true },
    async ({ todo, caller, ctx }) => {
      const body = ctx.body as {
        title: string;
        notes?: string | null;
        category_id?: string | null;
        power?: number | null;
        assignee_id?: string | null;
        due_on?: string | null;
        recurrence?: "none" | "weekly" | "monthly" | "yearly";
        keep_assignee?: boolean;
      };
      const task = await withIdempotency(
        todo,
        caller,
        { key: idempotencyKey(req), endpoint: `POST /groups/${id}/tasks` },
        (scoped) =>
          createTask(scoped, caller, id, {
            title: body.title,
            notes: body.notes ?? undefined,
            categoryId: body.category_id ?? null,
            power: body.power ?? null,
            assigneeId: body.assignee_id ?? null,
            dueOn: body.due_on ?? null,
            recurrence: body.recurrence,
            keepAssignee: body.keep_assignee,
          }),
      );
      return json({ task });
    },
  );
}
