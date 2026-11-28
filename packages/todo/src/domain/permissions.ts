import { TodoDomainError } from "./errors.js";

/**
 * The rules of Tareas, in one place and without a database (spec §4).
 *
 * A task has one holder or none and there are no creator privileges: a free task
 * belongs to the group, a held one belongs to whoever holds it. The API applies
 * these functions before touching the schema; the SQL only enforces isolation
 * between groups.
 */

export type TaskState = "pending" | "done";

export interface TaskRuleInput {
  assigneeId: string | null;
  state: TaskState;
}

export const GROUP_NAME_MAX = 60;
export const TASK_TITLE_MAX = 120;

/** Characters, not UTF-16 units: an emoji is one character in PostgreSQL. */
export function charLength(value: string): number {
  return [...value].length;
}

function required(value: string, max: number, field: string): string {
  const trimmed = value.trim();
  const length = charLength(trimmed);
  if (length < 1 || length > max) {
    throw new TodoDomainError("validation_failed", `${field} must be 1..${max} characters`, {
      field,
      length,
    });
  }
  return trimmed;
}

export function groupName(raw: string): string {
  return required(raw, GROUP_NAME_MAX, "name");
}

export function taskTitle(raw: string): string {
  return required(raw, TASK_TITLE_MAX, "title");
}

const holds = (userId: string, task: TaskRuleInput) => task.assigneeId === userId;
const free = (task: TaskRuleInput) => task.assigneeId === null;
const pending = (task: TaskRuleInput) => task.state === "pending";

/** Free: any member. Held: only its holder. Done: nobody. */
export function canEditTask(userId: string, task: TaskRuleInput): boolean {
  return pending(task) && (free(task) || holds(userId, task));
}

/** Only the holder completes, and only while it is pending. */
export function canCompleteTask(userId: string, task: TaskRuleInput): boolean {
  return pending(task) && holds(userId, task);
}

/** A pending task can be thrown away; a done one counts for the power. */
export function canDeleteTask(userId: string, task: TaskRuleInput): boolean {
  return canEditTask(userId, task);
}

/** Ask the current holder: it needs a holder who is not the caller. */
export function canRequestTask(userId: string, task: TaskRuleInput): boolean {
  return pending(task) && task.assigneeId !== null && !holds(userId, task);
}

/** The holder hands it back to the group. */
export function canReleaseTask(userId: string, task: TaskRuleInput): boolean {
  return pending(task) && holds(userId, task);
}

/** Undoing a completion is the holder's call, inside the open season. */
export function canReopenTask(userId: string, task: TaskRuleInput): boolean {
  return task.state === "done" && holds(userId, task);
}

export function canManageGroup(userId: string, group: { ownerId: string | null }): boolean {
  return group.ownerId !== null && group.ownerId === userId;
}

export type PowerPeriod = "infinite" | "weekly" | "monthly" | "yearly";

/** The personal group never plays the power game (spec §5.5). */
export function groupPower(
  kind: "group" | "personal",
  powerEnabled: boolean,
  powerPeriod: PowerPeriod,
): { powerEnabled: boolean; powerPeriod: PowerPeriod } {
  if (kind === "personal" && (powerEnabled || powerPeriod !== "infinite")) {
    throw new TodoDomainError("personal_group", "a personal group has no power");
  }
  return { powerEnabled, powerPeriod };
}
