import type { Caller } from "./groups";
import { getTask } from "./tasks";
import { TodoDomainError } from "./errors";
import { canRequestTask, canReopenTask } from "./permissions";
import { emitRequestCreated, emitRequestResolved, emitTaskAssigned } from "./events";
import { refund } from "./power";
import { localDate } from "./recurrence";
import type { TodoDeps } from "./types";

/**
 * Requests to take a task somebody else holds (spec §5.2) and undo (spec §5.4).
 *
 * One pending request per task, it expires on its own, and only the current
 * holder answers. Accepting moves the task in the same statement that resolves
 * the request, so two taps cannot hand it to two people.
 */

const REQUEST_COLUMNS = `r.id, r.group_id, r.task_id, r.requester_id, r.state,
  to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
  to_char(r.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires_at,
  to_char(r.resolved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as resolved_at,
  t.title as task_title, g.name as group_name, p.display_name as requester_name`;

/**
 * The inbox is read by a person, so it names the task, its group and who asks;
 * ids alone would render an empty row in the app. The task join never drops a
 * request: deleting a task cascades its requests away.
 */
const REQUEST_JOINS = `join module_todo.todo_tasks t on t.id = r.task_id
  join module_todo.todo_groups g on g.id = r.group_id
  left join public.profiles p on p.id = r.requester_id`;

export interface RequestView {
  id: string;
  groupId: string;
  taskId: string;
  requesterId: string | null;
  state: "pending" | "accepted" | "denied" | "expired";
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  taskTitle: string;
  groupName: string;
  requesterName: string;
}

function toRequest(row: Record<string, unknown>): RequestView {
  const stamp = (value: unknown) => (value === null || value === undefined ? null : String(value));
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    taskId: String(row.task_id),
    requesterId: row.requester_id === null ? null : String(row.requester_id),
    state: row.state as RequestView["state"],
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    resolvedAt: stamp(row.resolved_at),
    taskTitle: text(row.task_title),
    groupName: text(row.group_name),
    requesterName: text(row.requester_name),
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
    `select t.id, t.group_id, t.state, t.assignee_id, t.title, g.timezone
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
     returning id`,
    [String(rows[0].group_id), taskId, caller.userId, ttl],
  ).catch((error: { code?: string }) => {
    if (error.code === "23505") {
      throw new TodoDomainError("request_exists", "somebody already asked for it");
    }
    throw error;
  });
  const { rows: created } = await deps.db.query(
    `select ${REQUEST_COLUMNS} from module_todo.todo_requests r ${REQUEST_JOINS} where r.id = $1`,
    [String(inserted[0]!.id)],
  );
  const request = toRequest(created[0]!);
  await emitRequestCreated(deps, {
    groupId: request.groupId,
    actorId: caller.userId,
    holderId: String(rows[0].assignee_id),
    taskId,
    requestId: request.id,
    title: String(rows[0].title ?? ""),
  });
  return request;
}

export async function listRequests(
  deps: TodoDeps,
  caller: Caller,
  direction: "incoming" | "outgoing",
): Promise<RequestView[]> {
  const { rows } = await deps.db.query(
    direction === "outgoing"
      ? `select ${REQUEST_COLUMNS} from module_todo.todo_requests r ${REQUEST_JOINS}
          join module_todo.todo_group_members m
            on m.group_id = r.group_id and m.user_id = $1
          where r.requester_id = $1 order by r.created_at desc limit 100`
      : `select ${REQUEST_COLUMNS} from module_todo.todo_requests r ${REQUEST_JOINS}
          join module_todo.todo_group_members m
            on m.group_id = r.group_id and m.user_id = $1
          where r.requester_id <> $1
            and ((r.state = 'pending' and t.assignee_id = $1) or r.decided_by = $1)
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
       ${REQUEST_JOINS}
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
      returning id`,
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
    await emitTaskAssigned(deps, {
      groupId: String(rows[0].group_id),
      actorId: caller.userId,
      assigneeId: String(rows[0].requester_id),
      taskId: String(rows[0].task_id),
      title: String(rows[0].task_title ?? ""),
    });
  }
  const { rows: answeredRows } = await deps.db.query(
    `select ${REQUEST_COLUMNS} from module_todo.todo_requests r ${REQUEST_JOINS} where r.id = $1`,
    [requestId],
  );
  const answered = toRequest(answeredRows[0]!);
  if (rows[0].requester_id) {
    await emitRequestResolved(deps, {
      groupId: answered.groupId,
      actorId: caller.userId,
      requesterId: String(rows[0].requester_id),
      taskId: answered.taskId,
      requestId: answered.id,
      title: answered.taskTitle,
      state: accept ? "accepted" : "denied",
    });
  }
  return answered;
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
): Promise<Awaited<ReturnType<typeof getTask>>> {
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
  // The route publishes the task, so it returns what every other write returns.
  return getTask(deps, caller, taskId);
}
