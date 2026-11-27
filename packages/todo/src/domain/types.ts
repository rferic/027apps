import type { QueryClient } from "@027apps/core/api/rate-limit-storage.js";

/** The database these use cases talk to (the module schema, no RLS bypass). */
export interface TodoDb extends QueryClient {}

export interface TodoDeps {
  db: TodoDb;
  /** Instance timezone when a group has none yet, and the settings both use. */
  now?: () => Date;
}

export type TodoGroupKind = "group" | "personal";
export type TodoGroup = {
  id: string;
  name: string;
  kind: TodoGroupKind;
  ownerId: string | null;
  timezone: string;
  powerEnabled: boolean;
  powerPeriod: "infinite" | "weekly" | "monthly" | "yearly";
  seasonNumber: number;
  seasonStartedOn: string;
};

export type TodoTaskState = "pending" | "done";
export type TodoRecurrence = "none" | "weekly" | "monthly" | "yearly";

export type TodoTask = {
  id: string;
  groupId: string;
  title: string;
  notes: string | null;
  categoryId: string | null;
  power: number | null;
  assigneeId: string | null;
  state: TodoTaskState;
  recurrence: TodoRecurrence;
  keepAssignee: boolean;
  dueOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  completedAt: string | null;
};
