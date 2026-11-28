import type { Caller } from "./groups";
import { emitTaskMissedPeriod, emitTaskOverdue } from "./events";
import type { TodoDeps } from "./types";

/**
 * The one warning a task gets (spec §5.6): the deadline passed with the task
 * still pending, or a period closed without it being done.
 *
 * `job_hourly` cannot emit events — module SQL may not write the Core's outbox —
 * so the notice is emitted from the read path instead: opening the module or its
 * tasks sweeps the caller's groups. The stamp is written before the event so two
 * people opening the app at the same time announce it once, and the update locks
 * the row so they cannot both win.
 */
export async function notifyOverdue(deps: TodoDeps, caller: Caller): Promise<number> {
  const { rows: overdue } = await deps.db.query(
    `update module_todo.todo_tasks t
        set overdue_notified_on = (now() at time zone g.timezone)::date
       from module_todo.todo_groups g
      where g.id = t.group_id
        and t.recurrence = 'none'
        and t.state = 'pending'
        and t.due_on is not null
        and t.due_on < (now() at time zone g.timezone)::date
        and t.overdue_notified_on is null
        and exists (
          select 1 from module_todo.todo_group_members m
           where m.group_id = g.id and m.user_id = $1
        )
      returning t.id, t.group_id, t.assignee_id, t.title`,
    [caller.userId],
  );

  for (const row of overdue) {
    await emitTaskOverdue(deps, {
      groupId: String(row.group_id),
      taskId: String(row.id),
      title: String(row.title),
      holderId: row.assignee_id === null ? null : String(row.assignee_id),
    });
  }

  const { rows: missed } = await deps.db.query(
    `update module_todo.todo_task_occurrences o
        set notified_at = now()
       from module_todo.todo_tasks t
       join module_todo.todo_groups g on g.id = t.group_id
      where t.id = o.task_id
        and o.outcome = 'missed'
        and o.notified_at is null
        and exists (
          select 1 from module_todo.todo_group_members m
           where m.group_id = g.id and m.user_id = $1
        )
      returning o.id, o.group_id, o.task_id, t.title, t.assignee_id,
                to_char(o.period_start, 'YYYY-MM-DD') as period_start,
                to_char(o.period_end, 'YYYY-MM-DD') as period_end`,
    [caller.userId],
  );

  for (const row of missed) {
    await emitTaskMissedPeriod(deps, {
      groupId: String(row.group_id),
      taskId: String(row.task_id),
      title: String(row.title),
      holderId: row.assignee_id === null ? null : String(row.assignee_id),
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
    });
  }

  return overdue.length + missed.length;
}
