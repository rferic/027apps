import type { SubmitInvitationResult } from "./invite-action-types";
import { validateInviteForm, type InviteFieldErrors, type InviteFormInput } from "./invite-form";
import type { MutationFailure } from "./mutation-result";

/** The web form calls the server action in process; tests inject a fake. */
export type SubmitInvitation = (input: { token: string; password: string }) => Promise<SubmitInvitationResult>;

export type InviteSubmitInput = InviteFormInput & { token: string };

export type InviteSubmitOutcome =
  | { kind: "invalid"; fieldErrors: InviteFieldErrors }
  | { kind: "redeemed"; role: "user" | "admin"; signInFailed?: boolean }
  | { kind: "failed"; failure: MutationFailure };

export interface InviteSubmitOptions {
  /** The server action; the component passes `submitInvitation`. */
  submit: SubmitInvitation;
}

/**
 * Validates the form, asks the server action to redeem the invitation and
 * reports the effective role. Navigation belongs to the component: the token
 * leaves the history only after the account exists.
 */
export async function submitInvite(
  input: InviteSubmitInput,
  options: InviteSubmitOptions,
): Promise<InviteSubmitOutcome> {
  const fieldErrors = validateInviteForm(input);
  if (Object.keys(fieldErrors).length > 0) return { kind: "invalid", fieldErrors };

  const result = await options.submit({ token: input.token, password: input.password });
  if (!result.ok) return { kind: "failed", failure: { ok: false, code: result.code } };

  return {
    kind: "redeemed",
    role: result.role,
    ...(result.signInFailed ? { signInFailed: true } : {}),
  };
}
