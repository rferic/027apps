import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import type { MutationFailure } from "@/lib/mutation-result";

/**
 * Heading of a failed redemption, derived from the envelope `code` only. The
 * server `message` is technical English and never reaches the page. It is split
 * by the thing that failed so each table stays small and readable.
 *
 * `not_found` covers an unknown token and a revoked invitation with the same
 * text: whoever holds the link already knows the invitation existed.
 */

/** The link itself is gone: unknown, expired or already consumed. */
function lifecycleHeading(code: string | undefined, messages: TranslationMap): string | null {
  switch (code) {
    case "not_found":
      return t("This invitation link is not valid.", messages);
    case "invitation_expired":
      return t("This invitation has expired. Ask an administrator for a new one.", messages);
    case "invitation_used":
      return t("This invitation has already been used.", messages);
    default:
      return null;
  }
}

/** The account behind the address: sign in with it instead of creating one. */
function accountHeading(code: string | undefined, messages: TranslationMap): string | null {
  switch (code) {
    case "existing_account":
      return t(
        "That email already has an account. Enter its current password to accept the invitation.",
        messages,
      );
    case "existing_account_signin_required":
      return t(
        "That email already has an account. Sign in with it to accept the invitation.",
        messages,
      );
    case "wrong_credentials":
      return t("The password is not correct.", messages);
    case "conflict":
      return t("This account is deactivated. Contact an administrator.", messages);
    default:
      return null;
  }
}

/**
 * The request never got a usable answer. `anonymous` is an invitation with no
 * address in the token: there is no "email it was sent to" to point at.
 */
function requestHeading(
  code: string | undefined,
  messages: TranslationMap,
  anonymous: boolean,
): string {
  switch (code) {
    case "validation_failed":
      return anonymous
        ? t(
            "Check the name, the email and the password: the password needs at least 12 characters.",
            messages,
          )
        : t("Use the email address this invitation was sent to.", messages);
    case "rate_limited":
      return t("Too many attempts. Wait a minute and try again.", messages);
    default:
      return t("We couldn't redeem this invitation. Check your connection and try again.", messages);
  }
}

export function inviteErrorHeading(
  failure: MutationFailure | null,
  messages: TranslationMap,
  anonymous = false,
): string {
  const code = failure?.code;
  return (
    lifecycleHeading(code, messages) ??
    accountHeading(code, messages) ??
    requestHeading(code, messages, anonymous)
  );
}
