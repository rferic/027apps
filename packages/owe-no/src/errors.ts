/** Domain failures the API maps to 404/403/422/409 with a stable code. */
export type OweError = "not_found" | "forbidden" | "validation_failed" | "conflict";

export class OweDomainError extends Error {
  constructor(
    readonly code: OweError,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OweDomainError";
  }
}
