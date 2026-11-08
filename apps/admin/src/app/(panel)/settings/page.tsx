import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PanelForbidden } from "@/components/panel-forbidden";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadSettingsCategories } from "@/lib/panel-settings";
import {
  canSeeSettingsSection,
  firstVisibleSettingsSection,
  settingsSectionByCategory,
  type SettingsSection,
} from "@/lib/settings-sections";

/**
 * The page reads the session while rendering; the layout's opt-out is not
 * inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

/**
 * `/settings` is a parent route: it sends the user to the first section its
 * role can see. The API order decides when it is available; the canonical
 * order is the fallback if that read fails.
 */
export default async function SettingsIndexPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const role = gate.user.role === "super_admin" ? "super_admin" : "admin";
  const settings = await loadSettingsCategories();
  const firstFromApi = settings.ok
    ? settings.categories
        .map((category) => settingsSectionByCategory(category.categoryKey))
        .find((section): section is SettingsSection => {
          return section !== undefined && canSeeSettingsSection(role, section);
        })
    : undefined;

  const target = firstFromApi ?? firstVisibleSettingsSection(role);
  redirect(`/settings/${target.slug}`);
}
