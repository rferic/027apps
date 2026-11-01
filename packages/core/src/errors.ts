/**
 * Domain error model and HTTP error envelope (ADR 0007).
 *
 * The `code` is the machine-readable contract: clients branch on it and never on
 * the message. The message is the canonical English text, which doubles as the
 * i18n catalogue key (ADR 0007, precision 2026-10-26).
 *
 * Security invariant: the envelope never carries stack traces, SQL, internal
 * paths or secrets — not even in development. A `DomainError` may hold a custom
 * message for server-side logs, but the envelope always renders the canonical
 * message for its code. Unknown errors collapse to `internal`.
 */

export type DomainErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'insufficient_scope'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'already_setup'
  | 'currency_not_enabled'
  | 'locale_not_available'
  | 'internal';

/** Canonical English message per code. It is the i18n catalogue key. */
export const DEFAULT_MESSAGES: Readonly<Record<DomainErrorCode, string>> = {
  validation_failed: 'Validation failed',
  unauthorized: 'Authentication required',
  insufficient_scope: 'Insufficient scope',
  not_found: 'Resource not found',
  conflict: 'State conflict',
  rate_limited: 'Too many requests',
  already_setup: 'Setup already completed',
  currency_not_enabled: 'Currency is not enabled',
  locale_not_available: 'Locale is not available',
  internal: 'Internal server error',
};

/** Minimum HTTP mapping from ADR 0007 §4. */
export const HTTP_STATUS: Readonly<Record<DomainErrorCode, number>> = {
  validation_failed: 400,
  unauthorized: 401,
  insufficient_scope: 403,
  not_found: 404,
  conflict: 409,
  already_setup: 409,
  rate_limited: 429,
  currency_not_enabled: 400,
  locale_not_available: 400,
  internal: 500,
};

export function httpStatusFor(code: DomainErrorCode): number {
  return HTTP_STATUS[code];
}

export interface ErrorEnvelope {
  error: {
    code: DomainErrorCode;
    message: string;
    request_id: string;
    details?: Record<string, unknown>;
  };
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Converts any thrown value into the ADR 0007 envelope. Field-by-field
 * construction guarantees no stack, SQL or internal path leaks even when the
 * error object carries extra information.
 */
export function toEnvelope(err: unknown, requestId: string): ErrorEnvelope {
  if (err instanceof DomainError) {
    return {
      error: {
        code: err.code,
        message: DEFAULT_MESSAGES[err.code],
        request_id: requestId,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }

  return {
    error: {
      code: 'internal',
      message: DEFAULT_MESSAGES.internal,
      request_id: requestId,
    },
  };
}
