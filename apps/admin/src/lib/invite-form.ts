/**
 * Client-side shape checks for the public redemption form. They mirror
 * `redeemInvitationSchema` (`packages/core/src/invitations/api.ts`) so an
 * obviously wrong form never costs a request; the Core still validates at the
 * edge, this is UX only.
 *
 * A named invitation carries its email and name in the token: the form shows
 * them as a read-only card and only asks for a password. An anonymous
 * invitation (`requires_identity`) asks for the name, email, password and its
 * confirmation, because the invitee fills them in at redemption.
 */
export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 200;
export const MAX_NAME = 80;

/** Same token shape the Core rejects as `not_found` before hashing. */
const TOKEN_PREFIX = "027_inv_";
const MAX_TOKEN_LENGTH = 200;

/** Loose shape check; the Core re-validates the address at the edge. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

export type InviteField = "password" | "confirmation" | "name" | "email";

export type InviteFieldError =
  | "password_required"
  | "password_short"
  | "password_long"
  | "password_mismatch"
  | "name_required"
  | "name_long"
  | "email_required"
  | "email_invalid";

export type InviteFieldErrors = Partial<Record<InviteField, InviteFieldError>>;

export interface InviteFormInput {
  password: string;
  confirmation?: string;
  /** Anonymous invitation: the name the invitee fills in. */
  name?: string;
  /** Anonymous invitation: the email the invitee fills in. */
  email?: string;
  /** Existing account: its own password has no length policy here. */
  accountExists?: boolean;
  /** Anonymous invitation: the form must collect name and email. */
  requiresIdentity?: boolean;
}

export function isValidInviteToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX) && token.length <= MAX_TOKEN_LENGTH;
}

function validateName(value: string | undefined, errors: InviteFieldErrors): void {
  const name = (value ?? "").trim();
  if (name.length === 0) {
    errors.name = "name_required";
  } else if (name.length > MAX_NAME) {
    errors.name = "name_long";
  }
}

function validateEmail(value: string | undefined, errors: InviteFieldErrors): void {
  const email = (value ?? "").trim();
  if (email.length === 0) {
    errors.email = "email_required";
  } else if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL_LENGTH) {
    errors.email = "email_invalid";
  }
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

  if (input.requiresIdentity === true) {
    validateName(input.name, errors);
    validateEmail(input.email, errors);
  }

  return errors;
}
