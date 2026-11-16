/**
 * Classifies a Supabase session-refresh failure so the proxy never confuses a
 * network problem with a revoked session (sprint 16, task 03).
 *
 * - `invalid`: the refresh token is gone, expired or revoked. The session is
 *   over; the proxy may clear the cookies and the entry gate sends the user to
 *   login.
 * - `unavailable`: network, timeout, 429 or 5xx. The session is untouched and
 *   the proxy answers a retryable 503 without clearing cookies.
 */
export type SessionRefreshOutcome = "ok" | "invalid" | "unavailable";

const INVALID_CODES = new Set([
  "invalid_grant",
  "session_not_found",
  "refresh_token_not_found",
  "user_not_found",
]);

const INVALID_NAMES = new Set([
  "AuthSessionMissingError",
  "AuthInvalidTokenResponseError",
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(error: unknown, key: string): string | null {
  const value = record(error)?.[key];
  return typeof value === "string" ? value : null;
}

function numberField(error: unknown, key: string): number | null {
  const value = record(error)?.[key];
  return typeof value === "number" ? value : null;
}

/**
 * Supabase Auth errors carry a `code`, a `name` and sometimes a `status`.
 * Unknown failures are treated as retryable: losing a session because a
 * request timed out is worse than asking the user to retry.
 */
export function classifyRefreshError(error: unknown): SessionRefreshOutcome {
  const code = stringField(error, "code");
  if (code && INVALID_CODES.has(code)) return "invalid";

  const name = stringField(error, "name");
  if (name && INVALID_NAMES.has(name)) return "invalid";

  const status = numberField(error, "status") ?? numberField(error, "statusCode");
  if (status === 400 || status === 401 || status === 403) return "invalid";

  // A 429 is a temporary rate limit; a 5xx, a TypeError/fetch failure, an
  // abort or an unknown shape is retryable.
  return "unavailable";
}
