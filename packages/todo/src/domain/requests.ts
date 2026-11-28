import type { Caller } from "./groups.js";
import { TodoDomainError } from "./errors.js";
import { canRequestTask, canReopenTask } from "./permissions.js";
import { refund } from "./power.js";
import { localDate } from "./recurrence.js";
import type { TodoDeps } from "./types.js";

/**
 * Requests to take a task somebody else holds (spec §5.2) and undo (spec §5.4).
 *
 * One pending request per task, it expires on its own, and only the current
 * holder answers. Accepting moves the task in the same statement that resolves
 * the request, so two taps cannot hand it to two people.
 */

const REQUEST_COLUMNS = `r.id, r.group_id, r.task_id, r.requester_id, r.state, r.created_at,
  r.expires_at, r.resolved_at`;

export interface RequestView {
  id: string;
  groupId: string;
  taskId: string;
  requesterId: string | null;
  state: "pending" | "accepted" | "denied" | "expired";
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
}

function toRequest(row: Record<string, unknown>): RequestView {
  const stamp = (value: unknown) => (value === null || value === undefined ? null : String(value));
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    taskId: String(row.task_id),
    requesterId: row.requester_id === null ? null : String(row.requester_id),
    state: row.state as RequestView["state"],
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    resolvedAt: stamp(row.resolved_at),
  };
}

const DEFAULT_TTL_HOURS = 24;

/** Ask the holder: 24 hours by default, one open request per task. */
export async function requestTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<RequestView> {
  const { rows } = await deps.db.query(
    `select t.id, t.group_id, t.state, t.assignee_id, g.timezone
       from module_todo.todo_tasks t
       join module_todo.todo_groups g on g.id = t.group_id
       join module_todo.todo_group_members m
         on m.group_id = t.group_id and m.user_id = $2
      where t.id = $1`,
    [taskId, caller.userId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "task not found");
  const task = {
    assigneeId: rows[0].assignee_id === null ? null : String(rows[0].assignee_id),
    state: rows[0].state as "pending" | "done",
  };
  if (!canRequestTask(caller.userId, task)) {
    throw new TodoDomainError(
      task.state === "done" ? "task_done" : "already_assigned",
      "only a pending task held by somebody else can be requested",
    );
  }
  const ttl = deps.requestTtlHours ?? DEFAULT_TTL_HOURS;
  const { rows: inserted } = await deps.db.query(
    `insert into module_todo.todo_requests (group_id, task_id, requester_id, expires_at)
     values ($1, $2, $3, now() + make_interval(hours => $4))
     returning ${REQUEST_COLUMNS.replaceAll("r.", "")}`,
    [String(rows[0].group_id), taskId, caller.userId, ttl],
  ).catch((error: { code?: string }) => {
    if (error.code === "23505") {
      throw new TodoDomainError("request_exists", "somebody already asked for it");
    }
    throw error;
  });
  return toRequest(inserted[0]!);
}

export async function listRequests(
  deps: TodoDeps,
  caller: Caller,
  direction: "incoming" | "outgoing",
): Promise<RequestView[]> {
  const { rows } = await deps.db.query(
    direction === "outgoing"
      ? `select ${REQUEST_COLUMNS} from module_todo.todo_requests r
          where r.requester_id = $1 order by r.created_at desc limit 100`
      : `select ${REQUEST_COLUMNS}
           from module_todo.todo_requests r
           join module_todo.todo_tasks t on t.id = r.task_id
          where t.assignee_id = $1
          order by (r.state = 'pending') desc, r.created_at desc
          limit 100`,
    [caller.userId],
  );
  return rows.map(toRequest);
}

async function answer(
  deps: TodoDeps,
  caller: Caller,
  requestId: string,
  accept: boolean,
): Promise<RequestView> {
  const { rows } = await deps.db.query(
    `select ${REQUEST_COLUMNS}, t.assignee_id, t.state as task_state
       from module_todo.todo_requests r
       join module_todo.todo_tasks t on t.id = r.task_id
       join module_todo.todo_group_members m
         on m.group_id = r.group_id and m.user_id = $2
      where r.id = $1`,
    [requestId, caller.userId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "request not found");
  if (rows[0].state !== "pending") {
    throw new TodoDomainError("request_expired", "the request is no longer open");
  }
  if (rows[0].assignee_id !== caller.userId) {
    throw new TodoDomainError("not_assignee", "only the holder answers");
  }
  if (accept && rows[0].task_state !== "pending") {
    throw new TodoDomainError("task_done", "the task is already done");
  }

  const { rows: resolved } = await deps.db.query(
    `update module_todo.todo_requests
        set state = $3, decided_by = $2, resolved_at = now()
      where id = $1 and state = 'pending'
      returning ${REQUEST_COLUMNS.replaceAll("r.", "")}`,
    [requestId, caller.userId, accept ? "accepted" : "denied"],
  );
  if (!resolved[0]) throw new TodoDomainError("request_expired", "the request is no longer open");

  if (accept) {
    await deps.db.query(
      `update module_todo.todo_tasks
          set assignee_id = $2, updated_at = now()
        where id = $1 and state = 'pending'`,
      [String(rows[0].task_id), rows[0].requester_id],
    );
  }
  return toRequest(resolved[0]);
}

export async function acceptRequest(
  deps: TodoDeps,
  caller: Caller,
  requestId: string,
): Promise<RequestView> {
  return answer(deps, caller, requestId, true);
}

export async function denyRequest(
  deps: TodoDeps,
  caller: Caller,
  requestId: string,
): Promise<RequestView> {
  return answer(deps, caller, requestId, false);
}

/** The hourly job: requests past their deadline close themselves, with no push. */
export async function expireRequests(deps: TodoDeps, now = deps.now?.() ?? new Date()): Promise<number> {
  const { rows } = await deps.db.query(
    `update module_todo.todo_requests
        set state = 'expired', resolved_at = $1
      where state = 'pending' and expires_at <= $1
      returning id`,
    [now.toISOString()],
  );
  return rows.length;
}

/**
 * Undo (D13): only the holder, and only while the completion belongs to the
 * season that is still open. A closed season is history and is never rewritten.
 */
export async function reopenTask(
  deps: TodoDeps,
  caller: Caller,
  taskId: string,
): Promise<{ id: string; state: "pending" }> {
  const { rows } = await deps.db.query(
    `select t.id, t.group_id, t.state, t.assignee_id, t.completed_at, t.recurrence, t.power,
            to_char(t.period_start, 'YYYY-MM-DD') as period_start,
            g.timezone, g.power_enabled, g.season_number,
            to_char(g.season_started_on, 'YYYY-MM-DD') as season_started_on
       from module_todo.todo_tasks t
       join module_todo.todo_groups g on g.id = t.group_id
       join module_todo.todo_group_members m
         on m.group_id = t.group_id and m.user_id = $2
      where t.id = $1`,
    [taskId, caller.userId],
  );
  if (!rows[0]) throw new TodoDomainError("not_found", "task not found");
  const task = {
    assigneeId: rows[0].assignee_id === null ? null : String(rows[0].assignee_id),
    state: rows[0].state as "pending" | "done",
  };
  if (!canReopenTask(caller.userId, task)) {
    throw new TodoDomainError("forbidden", "only the holder undoes a completed task");
  }

  // A completion from a season that already closed cannot be undone.
  if (rows[0].power_enabled === true) {
    const seasonStart = String(rows[0].season_started_on);
    const completed = rows[0].completed_at ? new Date(String(rows[0].completed_at)) : null;
    if (completed && localDate(completed, String(rows[0].timezone)) < seasonStart) {
      throw new TodoDomainError("season_closed", "that season is closed");
    }
  }

  await deps.db.query(
    `update module_todo.todo_tasks
        set state = 'pending', completed_at = null, completed_by = null, updated_at = now()
      where id = $1 and state = 'done'`,
    [taskId],
  );
  if (rows[0].recurrence !== "none" && rows[0].period_start) {
    await deps.db.query(
      `delete from module_todo.todo_task_occurrences
        where task_id = $1 and period_start = $2`,
      [taskId, String(rows[0].period_start)],
    );
  }
  if (rows[0].power_enabled === true) {
    await refund(
      deps,
      String(rows[0].group_id),
      caller.userId,
      Number(rows[0].season_number),
      rows[0].power === null ? null : Number(rows[0].power),
    );
  }
  return { id: taskId, state: "pending" };
}
