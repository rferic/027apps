import type { Locale } from "@027apps/i18n/types.js";
import type { PanelUser } from "./panel-guard";

/**
 * UI language for a panel page: the profile wins over the cookie. The fallback
 * only covers tests and partial guards; a real panel render always has a user.
 */
export function panelLocale(user: PanelUser | undefined): Locale {
  return user?.locale ?? "en";
}
