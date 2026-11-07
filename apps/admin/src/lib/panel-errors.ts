import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { memberErrorCodeLabel } from "@/lib/member-errors";

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
