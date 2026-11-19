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

export const DOMAIN_ERROR_CODES = [
  'validation_failed',
  'unauthorized',
  'insufficient_scope',
  'not_found',
  'conflict',
  'rate_limited',
  'already_setup',
  'invitation_expired',
  'invitation_used',
  'invitation_not_expired',
  'invitation_not_renewable',
  'invitation_quota_exhausted',
  'invitation_quota_available',
  'invitation_inviter_inactive',
  'request_pending',
  'request_resolved',
  'join_code_used',
  'existing_account_signin_required',
  'currency_not_enabled',
  'locale_not_available',
  'cors_origin_not_allowed',
  'payload_too_large',
  'currency_is_default',
  'internal',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/** Canonical English message per code. It is the i18n catalogue key. */
export const DEFAULT_MESSAGES: Readonly<Record<DomainErrorCode, string>> = {
  validation_failed: 'Validation failed',
  unauthorized: 'Authentication required',
  insufficient_scope: 'Insufficient scope',
  not_found: 'Resource not found',
  conflict: 'State conflict',
  rate_limited: 'Too many requests',
  already_setup: 'Setup already completed',
  invitation_expired: 'The invitation is past its expiry',
  invitation_used: 'The invitation was already redeemed',
  invitation_not_expired: 'The invitation has not expired yet',
  invitation_not_renewable: 'Member and QR invitations can only be revoked',
  invitation_quota_exhausted: 'No invitation seats left',
  invitation_quota_available: 'You still have invitation seats available',
  invitation_inviter_inactive: 'The inviter can no longer invite',
  request_pending: 'A pending invitation request already exists',
  request_resolved: 'That invitation request was already resolved',
  join_code_used: 'That QR code was already used',
  existing_account_signin_required:
    'That email already has an account: sign in with it to accept the invitation',
  currency_not_enabled: 'Currency is not enabled',
  locale_not_available: 'Locale is not available',
  cors_origin_not_allowed: 'CORS origin not allowed',
  payload_too_large: 'Request body too large',
  currency_is_default: 'Currency is the default and cannot be disabled',
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
  invitation_expired: 409,
  invitation_used: 409,
  invitation_not_expired: 409,
  invitation_not_renewable: 409,
  invitation_quota_exhausted: 409,
  invitation_quota_available: 409,
  invitation_inviter_inactive: 409,
  request_pending: 409,
  request_resolved: 409,
  join_code_used: 410,
  existing_account_signin_required: 409,
  rate_limited: 429,
  currency_not_enabled: 400,
  locale_not_available: 400,
  cors_origin_not_allowed: 403,
  payload_too_large: 413,
  currency_is_default: 409,
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
