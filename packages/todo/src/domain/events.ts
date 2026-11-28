import { enqueueEvent } from "@027apps/core/realtime/service.js";
import type { JsonValue } from "@027apps/core/api/types.js";
import type { TodoDeps } from "./types.js";

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
      group_id: args.groupId,
      power: args.power,
      actor_id: args.actorId,
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
      group_id: args.groupId,
      actor_id: args.actorId,
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
      group_id: args.groupId,
      power: args.power,
      actor_id: args.actorId,
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
      group_id: args.groupId,
      actor_id: args.actorId,
    }),
    notify: ["push"],
  });
}

export async function emitRequestCreated(
  deps: TodoDeps,
  args: { groupId: string; actorId: string; holderId: string; taskId: string; title: string },
): Promise<void> {
  await enqueueEvent(deps.db, {
    module_key: MODULE,
    type: "todo.request_created",
    target: "user",
    subject_id: args.holderId,
    resource: resource({
      task_id: args.taskId,
      title: args.title,
      group_id: args.groupId,
      request_id: null,
      actor_id: args.actorId,
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
      group_id: args.groupId,
      state: args.state,
      actor_id: args.actorId,
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
    }),
    notify: ["push"],
  });
}
