/** Domain failures the API maps to 404/403/409/422 with a stable code (spec §6). */
export type TodoError =
  | "not_found"
  | "forbidden"
  | "validation_failed"
  | "already_assigned"
  | "task_done"
  | "task_pending"
  | "request_exists"
  | "request_expired"
  | "not_assignee"
  | "season_closed"
  | "power_disabled"
  | "personal_group"
  | "last_owner";

export class TodoDomainError extends Error {
  constructor(
    readonly code: TodoError,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TodoDomainError";
  }
}
