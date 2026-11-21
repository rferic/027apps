import type { SubmitInvitationResult } from "./invite-action-types";
import { validateInviteForm, type InviteFieldErrors, type InviteFormInput } from "./invite-form";
import type { MutationFailure } from "./mutation-result";

/** The web form calls the server action in process; tests inject a fake. */
export type SubmitInvitation = (input: {
  token: string;
  password: string;
  /** Anonymous invitation: the name/email the invitee filled in. */
  name?: string;
  email?: string;
  /** The invitee confirmed signing in with an account that already exists. */
  accountExists?: boolean;
}) => Promise<SubmitInvitationResult>;

export type InviteSubmitInput = InviteFormInput & { token: string };

export type InviteSubmitOutcome =
  | { kind: "invalid"; fieldErrors: InviteFieldErrors }
  | {
      kind: "redeemed";
      role: "super_admin" | "admin" | "user";
      signInFailed?: boolean;
      /** The invitation was applied to an account that already existed. */
      existingAccount?: boolean;
    }
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

  const result = await options.submit({
    token: input.token,
    password: input.password,
    // Only an anonymous invitation collects a name/email; a named one carries
    // them in the token and must not send empty strings that fail validation.
    ...(input.requiresIdentity ? { name: input.name, email: input.email } : {}),
    // The form switched to "current password" after the server said the email
    // has an account: this submit is the invitee confirming that sign-in.
    ...(input.accountExists ? { accountExists: true } : {}),
  });
  if (!result.ok) return { kind: "failed", failure: { ok: false, code: result.code } };

  return {
    kind: "redeemed",
    role: result.role,
    ...(result.signInFailed ? { signInFailed: true } : {}),
    ...(result.existingAccount ? { existingAccount: true } : {}),
  };
}
