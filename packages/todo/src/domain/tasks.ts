import { requireMember } from "./groups";
import type { Caller } from "./groups";
import { TodoDomainError } from "./errors";
import {
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReleaseTask,
  taskTitle,
} from "./permissions";
import { localDate, nextPeriod, periodEnded, periodFor, type Recurrence } from "./recurrence";
import { emitTaskCompleted, emitTaskCreated, emitTaskReleased } from "./events";
import { award } from "./power";
import type { TodoDeps, TodoTask, TodoTaskState } from "./types";

/**
 * Tasks (spec §5.2–§5.4): create, edit, take, release, complete and delete.
 *
 * The permission functions decide; the SQL only narrows the row it touches, so a
 * lost race (somebody else took the task a millisecond earlier) fails as a
 * conflict instead of overwriting.
 */

// `date` columns come back as text so the view never depends on how the driver
// parses them; timestamps are normalized to ISO in `toTask`.
const TASK_COLUMNS = `t.id, t.group_id, t.title, t.notes, t.category_id, t.power, t.assignee_id,
  t.state, t.recurrence, t.keep_assignee,
  to_char(t.due_on, 'YYYY-MM-DD') as due_on,
  to_char(t.period_start, 'YYYY-MM-DD') as period_start,
  to_char(t.period_end, 'YYYY-MM-DD') as period_end,
  to_char(t.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as completed_at,
  t.completed_by,
  to_char(t.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at`;

export interface TaskView extends TodoTask {
  createdAt: string;
}

export interface TaskFilters {
  state?: TodoTaskState | "all";
  categoryId?: string;
  mine?: boolean;
  overdue?: boolean;
  limit?: number;
  cursor?: string;
}

export interface TaskPage {
  tasks: TaskView[];
  nextCursor: string | null;
}

interface TaskRow extends TaskView {
  timezone: string;
  powerEnabled: boolean;
}

function toTask(row: Record<string, unknown>): TaskView {
  const date = (value: unknown) => (value === null || value === undefined ? null : String(value));

  return {
    id: String(row.id),
    groupId: String(row.group_id),
    title: String(row.title),
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    categoryId: date(row.category_id),
    power: row.power === null || row.power === undefined ? null : Number(row.power),
    assigneeId: date(row.assignee_id),
    state: row.state as TodoTaskState,
    recurrence: row.recurrence as TodoTask["recurrence"],
    keepAssignee: row.keep_assignee === true,
    dueOn: date(row.due_on),
    periodStart: date(row.period_start),
    periodEnd: date(row.period_end),
    completedAt: date(row.completed_at),
    // The microseconds matter: the cursor compares (created_at, id) exactly.
    createdAt: String(row.created_at),
  };
}

async function load(
  deps: TodoDeps,
  userId: string,
  taskId: string,
): Promise<{ task: TaskView; timezone: string; powerEnabled: boolean; seasonNumber: number }> {
  const { rows } = await deps.db.query(
    `select ${TASK_COLUMNS}, g.timezone, g.power_enabled, g.season_number
       from module_todo.todo_tasks t
       join module_todo.todo_groups g on g.id = t.group_id
       join module_todo.todo_group_members m
         on m.group_id = t.group_id and m.user_id = $2
      where t.id = $1`,
    [taskId, userId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "task not found");
  return {
    task: toTask(rows[0]),
    timezone: String(rows[0].timezone),
    powerEnabled: rows[0].power_enabled === true,
    seasonNumber: Number(rows[0].season_number),
  };
}

function encodeCursor(task: TaskView): string {
  return Buffer.from(`${task.createdAt}|${task.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const [createdAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!createdAt || !id) throw new TodoDomainError("validation_failed", "invalid cursor");
  return { createdAt, id };
}

export async function createTask(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
  input: {
    title: string;
    notes?: string;
    categoryId?: string | null;
    power?: number | null;
    assigneeId?: string | null;
    dueOn?: string | null;
    recurrence?: Recurrence | "none";
    keepAssignee?: boolean;
  },
): Promise<TaskView> {
  const group = await requireMember(deps, caller.userId, groupId);
  const title = taskTitle(input.title);
  const notes = input.notes?.trim() ?? null;
  if (notes !== null && [...notes].length > 2000) {
    throw new TodoDomainError("validation_failed", "notes are too long");
  }

  const recurrence = input.recurrence ?? "none";
  if (recurrence !== "none" && input.dueOn) {
    throw new TodoDomainError("validation_failed", "a periodic task has no due date");
  }
  const period =
    recurrence === "none"
      ? { start: null, end: null }
      : periodFor(recurrence, localDate(deps.now?.() ?? new Date(), group.timezone));

  if (input.categoryId) {
    const { rows } = await deps.db.query("select 1 from module_todo.todo_categories where id = $1", [
      input.categoryId,
    ]);
    if (!rows[0]) throw new TodoDomainError("not_found", "category not found");
  }

  if (input.assigneeId) {
    const { rows } = await deps.db.query(
      `select 1 from module_todo.todo_group_members where group_id = $1 and user_id = $2`,
      [groupId, input.assigneeId],
    );
    if (!rows[0]) throw new TodoDomainError("validation_failed", "the assignee is not a member");
  }

  // The power belongs to the group: without the game the value is not stored.
  const power = group.powerEnabled ? (input.power ?? null) : null;
  if (power !== null && (power < 1 || power > 5)) {
    throw new TodoDomainError("validation_failed", "power must be 1..5");
  }

  const { rows } = await deps.db.query(
    `insert into module_todo.todo_tasks
       (group_id, title, notes, category_id, power, assignee_id, recurrence, keep_assignee,
        due_on, period_start, period_end, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning ${TASK_COLUMNS.replaceAll("t.", "")}`,
    [
      groupId,
      title,
      notes,
      input.categoryId ?? null,
      power,
      input.assigneeId ?? null,
      recurrence,
      input.keepAssignee ?? false,
      recurrence === "none" ? (input.dueOn ?? null) : null,
      period.start,
      period.end,
      caller.userId,
    ],
  );
  const task = toTask(rows[0]!);
  await emitTaskCreated(deps, {
    groupId,
    actorId: caller.userId,
    taskId: task.id,
    title: task.title,
    assigneeId: task.assigneeId,
    power: task.power,
  });
  return task;
}

export async function getTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<TaskView> {
  return (await load(deps, caller.userId, taskId)).task;
}

export async function listTasks(
  deps: TodoDeps,
  caller: Caller,
  groupId: string,
  filters: TaskFilters = {},
): Promise<TaskPage> {
  const group = await requireMember(deps, caller.userId, groupId);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const params: unknown[] = [groupId];
  const where: string[] = ["t.group_id = $1"];

  if (filters.state && filters.state !== "all") {
    params.push(filters.state);
    where.push(`t.state = $${params.length}`);
  }
  if (filters.categoryId) {
    params.push(filters.categoryId);
    where.push(`t.category_id = $${params.length}`);
  }
  if (filters.mine) {
    params.push(caller.userId);
    where.push(`t.assignee_id = $${params.length}`);
  }
  if (filters.overdue) {
    params.push(localDate(deps.now?.() ?? new Date(), group.timezone));
    where.push(`t.state = 'pending' and t.due_on is not null and t.due_on < $${params.length}`);
  }
  if (filters.cursor) {
    const cursor = decodeCursor(filters.cursor);
    params.push(cursor.createdAt, cursor.id);
    where.push(`(t.created_at, t.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
  }

  params.push(limit + 1);
  const { rows } = await deps.db.query(
    `select ${TASK_COLUMNS}
       from module_todo.todo_tasks t
      where ${where.join(" and ")}
      order by t.created_at desc, t.id desc
      limit $${params.length}`,
    params,
  );
  const tasks = rows.slice(0, limit).map(toTask);
  return {
    tasks,
    nextCursor: rows.length > limit ? encodeCursor(tasks[tasks.length - 1]!) : null,
  };
}

export async function updateTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
  patch: {
    title?: string;
    notes?: string | null;
    categoryId?: string | null;
    power?: number | null;
    dueOn?: string | null;
  },
): Promise<TaskView> {
  const { task, powerEnabled } = await load(deps, caller.userId, taskId);
  if (!canEditTask(caller.userId, task)) {
    throw new TodoDomainError("forbidden", "only the holder edits a task in progress");
  }
  const title = patch.title === undefined ? task.title : taskTitle(patch.title);
  const notes = patch.notes === undefined ? task.notes : patch.notes?.trim() ?? null;
  const power =
    patch.power === undefined || !powerEnabled ? task.power : patch.power === null ? null : patch.power;
  if (power !== null && (power < 1 || power > 5)) {
    throw new TodoDomainError("validation_failed", "power must be 1..5");
  }
  const dueOn = patch.dueOn === undefined ? task.dueOn : patch.dueOn;

  const { rows } = await deps.db.query(
    `update module_todo.todo_tasks
        set title = $2, notes = $3, category_id = $4, power = $5, due_on = $6, updated_at = now()
      where id = $1
      returning ${TASK_COLUMNS.replaceAll("t.", "")}`,
    [taskId, title, notes, patch.categoryId === undefined ? task.categoryId : patch.categoryId, power, dueOn],
  );
  return toTask(rows[0]!);
}

export async function deleteTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<void> {
  const { task } = await load(deps, caller.userId, taskId);
  if (task.state === "done") {
    throw new TodoDomainError("task_done", "a completed task cannot be deleted");
  }
  if (!canDeleteTask(caller.userId, task)) {
    throw new TodoDomainError("forbidden", "only the holder deletes a task in progress");
  }
  await deps.db.query("delete from module_todo.todo_tasks where id = $1", [taskId]);
}

/** Taking a free task: the update itself is the race guard. */
export async function claimTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<TaskView> {
  await load(deps, caller.userId, taskId);
  const { rows } = await deps.db.query(
    `update module_todo.todo_tasks
        set assignee_id = $2, updated_at = now()
      where id = $1 and state = 'pending' and assignee_id is null
      returning ${TASK_COLUMNS.replaceAll("t.", "")}`,
    [taskId, caller.userId],
  );
  if (!rows[0]) throw new TodoDomainError("already_assigned", "somebody took it first");
  return toTask(rows[0]);
}

export async function releaseTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<TaskView> {
  const { task } = await load(deps, caller.userId, taskId);
  if (!canReleaseTask(caller.userId, task)) {
    throw new TodoDomainError("not_assignee", "only the holder releases a task");
  }
  const { rows } = await deps.db.query(
    `update module_todo.todo_tasks
        set assignee_id = null, updated_at = now()
      where id = $1 and state = 'pending' and assignee_id = $2
      returning ${TASK_COLUMNS.replaceAll("t.", "")}`,
    [taskId, caller.userId],
  );
  if (!rows[0]) throw new TodoDomainError("task_done", "the task is already done");
  const released = toTask(rows[0]);
  await emitTaskReleased(deps, {
    groupId: released.groupId,
    actorId: caller.userId,
    taskId: released.id,
    title: released.title,
  });
  return released;
}

/**
 * Completing writes the occurrence of the period, which is what the history and
 * the results page count. A one-off task gets a single occurrence on the day it
 * was created, so re-completing it after an undo never adds a second row.
 */
export async function completeTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<TaskView> {
  const { task, timezone, powerEnabled, seasonNumber } = await load(deps, caller.userId, taskId);
  if (!canCompleteTask(caller.userId, task)) {
    throw new TodoDomainError(
      task.state === "done" ? "task_done" : "forbidden",
      "only the holder completes a pending task",
    );
  }
  const now = deps.now?.() ?? new Date();
  const period =
    task.recurrence === "none"
      ? { start: localDate(new Date(task.createdAt), timezone), end: localDate(new Date(task.createdAt), timezone) }
      : { start: task.periodStart!, end: task.periodEnd! };

  const { rows } = await deps.db.query(
    `update module_todo.todo_tasks
        set state = 'done', completed_at = $2, completed_by = $3, updated_at = now()
      where id = $1 and state = 'pending' and assignee_id = $4
      returning ${TASK_COLUMNS.replaceAll("t.", "")}`,
    [taskId, now.toISOString(), caller.userId, caller.userId],
  );
  if (!rows[0]) throw new TodoDomainError("task_done", "the task is already done");

  await deps.db.query(
    `insert into module_todo.todo_task_occurrences
       (group_id, task_id, period_start, period_end, outcome, completed_at, completed_by)
     values ($1, $2, $3, $4, 'done', $5, $6)
     on conflict (task_id, period_start) do update
       set outcome = 'done', completed_at = excluded.completed_at,
           completed_by = excluded.completed_by`,
    [task.groupId, taskId, period.start, period.end, now.toISOString(), caller.userId],
  );
  if (powerEnabled) {
    await award(deps, task.groupId, caller.userId, seasonNumber, task.power);
  }
  const completed = toTask(rows[0]);
  await emitTaskCompleted(deps, {
    groupId: completed.groupId,
    actorId: caller.userId,
    taskId: completed.id,
    title: completed.title,
    power: completed.power,
  });
  return completed;
}

/**
 * Closes the period of a periodic task: the untouched one is recorded as missed,
 * the task returns to pending and, unless it keeps its holder, back to the group.
 * Idempotent: a task whose period has not ended is left alone.
 */
export async function advancePeriod(
  deps: TodoDeps,
  taskId: string,
): Promise<{ advanced: boolean; task: TaskView | null }> {
  const { rows } = await deps.db.query(
    `select ${TASK_COLUMNS}, g.timezone
       from module_todo.todo_tasks t
       join module_todo.todo_groups g on g.id = t.group_id
      where t.id = $1`,
    [taskId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "task not found");
  const task = toTask(rows[0]);
  const timezone = String(rows[0].timezone);
  if (task.recurrence === "none" || !task.periodStart || !task.periodEnd) {
    return { advanced: false, task };
  }
  const now = deps.now?.() ?? new Date();
  if (!periodEnded({ start: task.periodStart, end: task.periodEnd }, now, timezone)) {
    return { advanced: false, task };
  }
  if (task.state === "pending") {
    await deps.db.query(
      `insert into module_todo.todo_task_occurrences
         (group_id, task_id, period_start, period_end, outcome)
       values ($1, $2, $3, $4, 'missed')
       on conflict (task_id, period_start) do update set outcome = 'missed'`,
      [task.groupId, taskId, task.periodStart, task.periodEnd],
    );
  }
  const next = nextPeriod(task.recurrence, task.periodEnd);
  const { rows: updated } = await deps.db.query(
    `update module_todo.todo_tasks
        set state = 'pending', completed_at = null, completed_by = null,
            period_start = $2, period_end = $3,
            assignee_id = case when keep_assignee then assignee_id else null end,
            updated_at = now()
      where id = $1
      returning ${TASK_COLUMNS.replaceAll("t.", "")}`,
    [taskId, next.start, next.end],
  );
  return { advanced: true, task: toTask(updated[0]!) };
}
