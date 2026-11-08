/**
 * Client-side shape checks for the public redemption form. They mirror
 * `redeemInvitationSchema` (`packages/core/src/invitations/api.ts`) so an
 * obviously wrong form never costs a request; the Core still validates at the
 * edge, this is UX only.
 */
export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 200;

/** Same token shape the Core rejects as `not_found` before hashing. */
const TOKEN_PREFIX = "027_inv_";
const MAX_TOKEN_LENGTH = 200;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteField = "email" | "password" | "confirmation";

export type InviteFieldError =
  | "email_required"
  | "email_invalid"
  | "password_short"
  | "password_long"
  | "password_mismatch";

export type InviteFieldErrors = Partial<Record<InviteField, InviteFieldError>>;

export interface InviteFormInput {
  email: string;
  password: string;
  confirmation: string;
}

export function isValidInviteToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX) && token.length <= MAX_TOKEN_LENGTH;
}

export function validateInviteForm(input: InviteFormInput): InviteFieldErrors {
  const errors: InviteFieldErrors = {};
  const email = input.email.trim();

  if (email.length === 0) {
    errors.email = "email_required";
  } else if (!EMAIL.test(email) || email.length > 320) {
    errors.email = "email_invalid";
  }

  if (input.password.length < MIN_PASSWORD) {
    errors.password = "password_short";
  } else if (input.password.length > MAX_PASSWORD) {
    errors.password = "password_long";
  }

  if (input.confirmation !== input.password) {
    errors.confirmation = "password_mismatch";
  }

  return errors;
}
