import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

/** Public error codes mapped to a readable message; unknown codes stay visible. */
export function memberErrorCodeLabel(code: string, messages: TranslationMap): string {
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
      return t("Unexpected error: {code}", messages, { code });
  }
}
