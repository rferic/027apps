import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import type { MutationFailure } from "@/lib/mutation-result";

/**
 * Heading of a failed redemption, derived from the envelope `code` only. The
 * server `message` is technical English and never reaches the page.
 *
 * `not_found` covers an unknown token and a revoked invitation with the same
 * text: whoever holds the link already knows the invitation existed.
 */
export function inviteErrorHeading(
  failure: MutationFailure | null,
  messages: TranslationMap,
): string {
  switch (failure?.code) {
    case "not_found":
      return t("This invitation link is not valid.", messages);
    case "invitation_expired":
      return t("This invitation has expired. Ask an administrator for a new one.", messages);
    case "invitation_used":
      return t("This invitation has already been used.", messages);
    case "conflict":
      return t("This account is deactivated. Contact an administrator.", messages);
    case "validation_failed":
      return t("Use the email address this invitation was sent to.", messages);
    case "rate_limited":
      return t("Too many attempts. Wait a minute and try again.", messages);
    default:
      return t("We couldn't redeem this invitation. Check your connection and try again.", messages);
  }
}
