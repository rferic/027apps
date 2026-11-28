import { describe, expect, it } from "vitest";
import { query } from "../pg.js";
import { inRollback, installTodo, session, todoDeps } from "./todo-fixture.js";
import { addMember, createGroup } from "@027apps/todo/domain/groups.js";
import { createTask } from "@027apps/todo/domain/tasks.js";
import { notifyOverdue } from "@027apps/todo/domain/overdue.js";

const TZ = "Europe/Madrid";

function daysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

async function notices(c: Parameters<typeof query>[0]) {
  const { rows } = await query(
    c,
    `select type, target, subject_id, resource
       from public.event_outbox
      where module_key = 'todo'
        and (type like 'todo.task_overdue%' or type like 'todo.task_missed%')
      order by created_at, type`,
  );
  return rows.map((row) => ({
    type: String(row.type),
    target: String(row.target),
    subject: row.subject_id === null ? null : String(row.subject_id),
    description: String((row.resource as { description?: string }).description ?? ""),
    group: String((row.resource as { group_name?: string }).group_name ?? ""),
  }));
}

describe("todo overdue notices", () => {
  it("warns once, to the group when free and to the holder when held", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const luis = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });
      await addMember(deps, me, group.id, luis.userId!);

      await createTask(deps, me, group.id, { title: "Pagar la luz", dueOn: daysAgo(2) });
      await createTask(deps, me, group.id, {
        title: "Llamar al seguro",
        dueOn: daysAgo(1),
        assigneeId: luis.userId,
      });
      // Not due yet, and done: neither warns.
      await createTask(deps, me, group.id, { title: "Mañana", dueOn: daysAgo(-1) });

      expect(await notifyOverdue(deps, me)).toBe(2);
      const channel = `channel:todo-group-${group.id}`;
      expect(await notices(c)).toEqual([
        {
          type: "todo.task_overdue",
          target: channel,
          subject: null,
          description: "Pagar la luz",
          group: "Casa",
        },
        {
          type: "todo.task_overdue_assigned",
          target: "user",
          subject: luis.userId,
          description: "Llamar al seguro",
          group: "Casa",
        },
      ]);

      // Once, not a reminder loop: the second sweep finds nothing new.
      expect(await notifyOverdue(deps, me)).toBe(0);
      expect(await notices(c)).toHaveLength(2);
    });
  });

  it("announces a period the job closed without the task being done", async () => {
    await inRollback(async (c) => {
      await installTodo(c);
      const deps = todoDeps(c);
      const ana = await session(c, "user");
      const me = { userId: ana.userId!, role: ana.role };
      const group = await createGroup(deps, me, { name: "Casa", timezone: TZ });

      // The job writes the missed occurrence; the sweep announces it.
      const task = await createTask(deps, me, group.id, {
        title: "Regar las plantas",
        recurrence: "weekly",
      });
      await query(
        c,
        `insert into module_todo.todo_task_occurrences
           (group_id, task_id, period_start, period_end, outcome)
         values ($1, $2, '2026-11-16', '2026-11-22', 'missed')`,
        [group.id, task.id],
      );

      expect(await notifyOverdue(deps, me)).toBe(1);
      expect(await notices(c)).toEqual([
        {
          type: "todo.task_missed_period",
          target: `channel:todo-group-${group.id}`,
          subject: null,
          description: "Regar las plantas",
          group: "Casa",
        },
      ]);
      expect(await notifyOverdue(deps, me)).toBe(0);
    });
  });
});
