import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { memberErrorCodeLabel } from "@/lib/member-errors";

/** Public error codes of the categories/invitations pages, plus the shared set. */
export function panelErrorCodeLabel(code: string, messages: TranslationMap): string {
  switch (code) {
    case "invitation_used":
      return t("This invitation has already been used.", messages);
    case "invitation_expired":
      return t("This invitation has expired.", messages);
    default:
      return memberErrorCodeLabel(code, messages);
  }
}
