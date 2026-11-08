import { validateInviteForm, type InviteFieldErrors, type InviteFormInput } from "./invite-form";
import { redeemInvitation } from "./invite-redeem";
import type { MutationFailure } from "./mutation-result";

/** Leaves the token out of the browser history once the account exists. */
export const LOGIN_AFTER_REDEEM = "/login?notice=invitation-redeemed";

export type InviteSubmitInput = InviteFormInput & { token: string };

export type InviteSubmitOutcome =
  | { kind: "invalid"; fieldErrors: InviteFieldErrors }
  | { kind: "redeemed" }
  | { kind: "failed"; failure: MutationFailure };

export interface InviteSubmitOptions {
  fetcher?: typeof fetch;
  /** `router.replace`, so the token is replaced instead of pushed. */
  replace?: (href: string) => void;
}

/**
 * Validates the form, redeems the invitation and, on success, replaces the
 * current history entry with the login notice. Split from the component so the
 * flow is testable without a DOM.
 */
export async function submitInvite(
  input: InviteSubmitInput,
  options: InviteSubmitOptions = {},
): Promise<InviteSubmitOutcome> {
  const fieldErrors = validateInviteForm(input);
  if (Object.keys(fieldErrors).length > 0) return { kind: "invalid", fieldErrors };

  const result = await redeemInvitation(
    { token: input.token, email: input.email, password: input.password },
    options.fetcher,
  );

  if (!result.ok) return { kind: "failed", failure: result };

  options.replace?.(LOGIN_AFTER_REDEEM);
  return { kind: "redeemed" };
}
