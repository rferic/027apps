import { enqueueEvent } from "@027apps/core/realtime/service.js";
import type { JsonValue } from "@027apps/core/api/types.js";
import type { TodoDeps } from "./types";

/**
 * The ten outbox events of the module (spec §5.6).
 *
 * Every resource carries `actor_id`: the Core drops the actor from the push, so
 * nobody is notified of their own doing. The data is a `{ key, payload }` pair the
 * app localizes; the server never composes text.
 */

const MODULE = "todo";
const channel = (groupId: string) => `channel:todo-group-${groupId}`;

function resource(fields: Record<string, JsonValue>): JsonValue {
  return fields;
}

/**
 * The two names a notification needs to say something: the group and the person
 * who acted. The Core's push payload reads `group_name`/`actor_name`; ids alone
 * would render a blank body on the lock screen.
 */
async function names(
  deps: TodoDeps,
  groupId: string,
  actorId: string | null,
): Promise<{ group_name: string; actor_name: string }> {
  const { rows } = await deps.db.query(
    `select g.name as group_name, p.display_name as actor_name
       from module_todo.todo_groups g
       left join public.profiles p on p.id = $2
      where g.id = $1`,
    [groupId, actorId],
  );
  return {
    group_name: String(rows[0]?.group_name ?? ""),
    actor_name: String(rows[0]?.actor_name ?? ""),
  };
}

export async function emitTaskCreated(
  deps: TodoDeps,
  args: {
    groupId: string;
    actorId: string;
    taskId: string;
    title: string;
    assigneeId: string | null;
    power: number | null;
  },
): Promise<void> {
  // Assigned to somebody else: only they are told. Assigned to the actor: nothing.
  const assigned = args.assigneeId !== null && args.assigneeId !== args.actorId;
  if (args.assigneeId !== null && !assigned) return;
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: assigned ? "todo.task_created_assigned" : "todo.task_created",
    target: assigned ? "user" : channel(args.groupId),
    subject_id: assigned ? args.assigneeId : null,
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      power: args.power,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}

export async function emitTaskReleased(
  deps: TodoDeps,
  args: { groupId: string; actorId: string; taskId: string; title: string },
): Promise<void> {
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.task_released",
    target: channel(args.groupId),
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}

export async function emitTaskCompleted(
  deps: TodoDeps,
  args: { groupId: string; actorId: string; taskId: string; title: string; power: number | null },
): Promise<void> {
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.task_completed",
    target: channel(args.groupId),
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      power: args.power,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}

/** The task now belongs to somebody else: only they are told. */
export async function emitTaskAssigned(
  deps: TodoDeps,
  args: { groupId: string; actorId: string; assigneeId: string; taskId: string; title: string },
): Promise<void> {
  if (args.assigneeId === args.actorId) return;
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.task_assigned",
    target: "user",
    subject_id: args.assigneeId,
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}

export async function emitRequestCreated(
  deps: TodoDeps,
  args: {
    groupId: string;
    actorId: string;
    holderId: string;
    taskId: string;
    requestId: string;
    title: string;
  },
): Promise<void> {
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.request_created",
    target: "user",
    subject_id: args.holderId,
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      // The notification's buttons answer this id without opening the app.
      request_id: args.requestId,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}

export async function emitRequestResolved(
  deps: TodoDeps,
  args: {
    groupId: string;
    actorId: string;
    requesterId: string;
    taskId: string;
    requestId: string;
    title: string;
    state: "accepted" | "denied";
  },
): Promise<void> {
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.request_resolved",
    target: "user",
    subject_id: args.requesterId,
    resource: resource({
      task_id: args.taskId,
      request_id: args.requestId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      state: args.state,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}

/**
 * The deadline passed with the task pending. A free task warns the group; a held
 * one warns only its holder. Nobody acted, so there is no actor to exclude.
 */
export async function emitTaskOverdue(
  deps: TodoDeps,
  args: { groupId: string; taskId: string; title: string; holderId: string | null },
): Promise<void> {
  const assigned = args.holderId !== null;
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: assigned ? "todo.task_overdue_assigned" : "todo.task_overdue",
    target: assigned ? "user" : channel(args.groupId),
    subject_id: assigned ? args.holderId : null,
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      actor_id: null,
      ...(await names(deps, args.groupId, null)),
    }),
    notify: ["push"],
  });
}

/** A period closed with the task undone: same recipients as an overdue task. */
export async function emitTaskMissedPeriod(
  deps: TodoDeps,
  args: {
    groupId: string;
    taskId: string;
    title: string;
    holderId: string | null;
    periodStart: string;
    periodEnd: string;
  },
): Promise<void> {
  const assigned = args.holderId !== null;
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: assigned ? "todo.task_missed_period_assigned" : "todo.task_missed_period",
    target: assigned ? "user" : channel(args.groupId),
    subject_id: assigned ? args.holderId : null,
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      description: args.title,
      group_id: args.groupId,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      actor_id: null,
      ...(await names(deps, args.groupId, null)),
    }),
    notify: ["push"],
  });
}

export async function emitSeasonClosed(
  deps: TodoDeps,
  args: { groupId: string; actorId: string; seasonNumber: number },
): Promise<void> {
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.season_closed",
    target: channel(args.groupId),
    resource: resource({
      group_id: args.groupId,
      season_number: args.seasonNumber,
      actor_id: args.actorId,
      ...(await names(deps, args.groupId, args.actorId)),
    }),
    notify: ["push"],
  });
}
