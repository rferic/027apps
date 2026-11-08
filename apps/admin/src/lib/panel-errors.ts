import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

/**
 * A create conflict on a category is a duplicate slug: the form shows it next
 * to the slug field instead of the generic conflict label.
 */
export function slugConflictError(
  error: { code?: string } | null,
  messages: TranslationMap,
): string | undefined {
  return error?.code === "conflict"
    ? t("A category with that slug already exists.", messages)
    : undefined;
}

/** Domain conflict a failed invitation create can explain on its own. */
export interface InvitationConflict {
  code?: string;
  details?: { code?: string };
}

/**
 * Invitation create conflicts the email field can name: the same address is
 * already a member, or it already holds a pending invitation. Keyed on the
 * public `details.code` (the envelope never carries the custom message), so an
 * unrelated `conflict` keeps the generic label.
 */
export function invitationConflictError(
  error: InvitationConflict | null,
  messages: TranslationMap,
): string | undefined {
  if (error?.code !== "conflict") return undefined;
  switch (error.details?.code) {
    case "email_registered":
      return t("That email already belongs to a member.", messages);
    case "pending_invitation":
      return t("That email already has a pending invitation.", messages);
    default:
      return undefined;
  }
}

/**
 * Public error codes mapped to a readable message. One map for every panel
 * surface (members, categories, invitations, keys, settings); unknown codes
 * stay visible instead of being swallowed.
 */
function genericErrorCodeLabel(code: string, messages: TranslationMap): string | undefined {
  switch (code) {
    case "internal":
      return t("Something went wrong on the server.", messages);
    case "insufficient_scope":
      return t("You do not have permission to do that.", messages);
    case "rate_limited":
      return t("Too many requests. Wait a moment and try again.", messages);
    case "not_found":
      return t("We could not find what you asked for.", messages);
    case "unauthorized":
      return t("Your session has expired. Sign in again.", messages);
    case "conflict":
      return t("This change conflicts with the instance rules.", messages);
    case "validation_failed":
      return t("The data you entered is not valid.", messages);
    default:
      return undefined;
  }
}

function domainErrorCodeLabel(code: string, messages: TranslationMap): string | undefined {
  switch (code) {
    case "invitation_used":
      return t("This invitation has already been used.", messages);
    case "invitation_expired":
      return t("This invitation has expired.", messages);
    case "currency_is_default":
      return t("The default currency cannot be disabled.", messages);
    case "currency_not_enabled":
      return t("Choose an enabled currency.", messages);
    default:
      return undefined;
  }
}

export function panelErrorCodeLabel(code: string, messages: TranslationMap): string {
  return (
    genericErrorCodeLabel(code, messages) ??
    domainErrorCodeLabel(code, messages) ??
    t("Unexpected error: {code}", messages, { code })
  );
}
