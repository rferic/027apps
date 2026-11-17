/**
 * Client-side shape checks for the public redemption form. They mirror
 * `redeemInvitationSchema` (`packages/core/src/invitations/api.ts`) so an
 * obviously wrong form never costs a request; the Core still validates at the
 * edge, this is UX only.
 *
 * The email is never a field: the token carries it and the form shows it as a
 * read-only card (A5). An existing account only asks for its current password;
 * a new one asks for a password and its confirmation.
 */
export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 200;

/** Same token shape the Core rejects as `not_found` before hashing. */
const TOKEN_PREFIX = "027_inv_";
const MAX_TOKEN_LENGTH = 200;

export type InviteField = "password" | "confirmation";

export type InviteFieldError =
  | "password_required"
  | "password_short"
  | "password_long"
  | "password_mismatch";

export type InviteFieldErrors = Partial<Record<InviteField, InviteFieldError>>;

export interface InviteFormInput {
  password: string;
  confirmation?: string;
  /** Existing account: its own password has no length policy here. */
  accountExists?: boolean;
}

export function isValidInviteToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX) && token.length <= MAX_TOKEN_LENGTH;
}

export function validateInviteForm(input: InviteFormInput): InviteFieldErrors {
  const errors: InviteFieldErrors = {};
  const existing = input.accountExists === true;

  if (input.password.length === 0) {
    errors.password = "password_required";
  } else if (!existing && input.password.length < MIN_PASSWORD) {
    errors.password = "password_short";
  } else if (input.password.length > MAX_PASSWORD) {
    errors.password = "password_long";
  }

  if (!existing && (input.confirmation ?? "") !== input.password) {
    errors.confirmation = "password_mismatch";
  }

  return errors;
}
