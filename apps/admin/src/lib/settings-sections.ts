import type { TranslationMap } from "@027apps/i18n/types.js";
import { t } from "@027apps/i18n/t.js";
import type { PanelRole } from "@/lib/panel-guard";

export type SettingsSectionSlug =
  | "instance"
  | "localization"
  | "security"
  | "notifications"
  | "rate-limits";

export interface SettingsSection {
  slug: SettingsSectionSlug;
  categoryKey: string;
  /** English catalog label; the nav renders it through a literal `t()`. */
  label: string;
  minRole: PanelRole;
}

/**
 * Canonical order of the settings sections. A category with its own page keeps
 * the route slug stable even when it differs from the catalog key
 * (`rate_limit` → `/panel/settings/rate-limits`).
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { slug: "instance", categoryKey: "instance", label: "Instance", minRole: "admin" },
  { slug: "localization", categoryKey: "localization", label: "Localization", minRole: "admin" },
  { slug: "security", categoryKey: "security", label: "Security", minRole: "super_admin" },
  { slug: "notifications", categoryKey: "notifications", label: "Notifications", minRole: "admin" },
  { slug: "rate-limits", categoryKey: "rate_limit", label: "Rate limits", minRole: "admin" },
];

export function settingsSectionBySlug(slug: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.slug === slug);
}

export function settingsSectionByCategory(categoryKey: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.categoryKey === categoryKey);
}

export function canSeeSettingsSection(role: PanelRole, section: SettingsSection): boolean {
  return section.minRole === "admin" || role === "super_admin";
}

export function visibleSettingsSections(role: PanelRole): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => canSeeSettingsSection(role, section));
}

export function firstVisibleSettingsSection(role: PanelRole): SettingsSection {
  return visibleSettingsSections(role)[0] ?? SETTINGS_SECTIONS[0];
}

/**
 * Section label through literal `t()` keys so `i18n:scan` sees every one; the
 * catalog label returned by the API is used for the page heading when present.
 */
export function settingsSectionLabel(
  section: SettingsSection,
  messages: TranslationMap,
): string {
  switch (section.slug) {
    case "instance":
      return t("Instance", messages);
    case "localization":
      return t("Localization", messages);
    case "security":
      return t("Security", messages);
    case "notifications":
      return t("Notifications", messages);
    case "rate-limits":
      return t("Rate limits", messages);
  }
}
