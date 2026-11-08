import { describe, expect, it } from "vitest";
import type { PanelRole } from "./panel-guard";
import {
  SETTINGS_SECTIONS,
  canSeeSettingsSection,
  firstVisibleSettingsSection,
  settingsSectionByCategory,
  settingsSectionBySlug,
  visibleSettingsSections,
} from "./settings-sections";

describe("settings sections", () => {
  it("maps every real category to its route slug", () => {
    expect(settingsSectionByCategory("instance")?.slug).toBe("instance");
    expect(settingsSectionByCategory("localization")?.slug).toBe("localization");
    expect(settingsSectionByCategory("security")?.slug).toBe("security");
    expect(settingsSectionByCategory("notifications")?.slug).toBe("notifications");
    expect(settingsSectionByCategory("rate_limit")?.slug).toBe("rate-limits");
    expect(settingsSectionBySlug("rate-limits")?.categoryKey).toBe("rate_limit");
    expect(settingsSectionBySlug("rate_limit")).toBeUndefined();
    expect(SETTINGS_SECTIONS).toHaveLength(5);
  });

  it("hides security from an admin in the menu and the route guard", () => {
    const admin: PanelRole = "admin";
    const root: PanelRole = "super_admin";

    expect(visibleSettingsSections(admin).map((section) => section.slug)).toEqual([
      "instance",
      "localization",
      "notifications",
      "rate-limits",
    ]);
    expect(visibleSettingsSections(root).map((section) => section.slug)).toEqual([
      "instance",
      "localization",
      "security",
      "notifications",
      "rate-limits",
    ]);
    expect(canSeeSettingsSection(admin, settingsSectionBySlug("security")!)).toBe(false);
    expect(canSeeSettingsSection(root, settingsSectionBySlug("security")!)).toBe(true);
  });

  it("returns the first section the role can see", () => {
    expect(firstVisibleSettingsSection("admin").slug).toBe("instance");
    expect(firstVisibleSettingsSection("super_admin").slug).toBe("instance");
  });
});
