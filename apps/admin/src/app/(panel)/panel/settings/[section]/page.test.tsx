import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadSettingsCategoriesMock = vi.fn();
const loadCurrenciesMock = vi.fn();
const settingsVisibilityMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  redirect: vi.fn(),
  usePathname: () => "/panel/settings/instance",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-settings", () => ({
  loadSettingsCategories: () => loadSettingsCategoriesMock(),
  loadCurrencies: () => loadCurrenciesMock(),
  settingsVisibility: (role: string) => settingsVisibilityMock(role),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import SettingsSectionPage from "./page";

function setting(categoryKey: string, key: string, label: string) {
  return {
    key,
    category: categoryKey,
    label,
    help: `${label} help`,
    type: "string" as const,
    isSecret: false,
    isPublic: true,
    superAdminOnly: false,
    readOnly: false,
    sortOrder: 10,
    updatedBy: null,
    updatedAt: "2026-11-01T10:00:00.000Z",
    value: "value",
  };
}

function category(categoryKey: string, label: string, key: string, settingLabel: string) {
  return {
    categoryKey,
    label,
    help: `${label} help`,
    icon: "server",
    sortOrder: 10,
    settings: [setting(categoryKey, key, settingLabel)],
  };
}

const CATEGORIES = [
  category("instance", "Instance", "instance.name", "Instance name"),
  category("localization", "Localization", "localization.timezone", "Timezone"),
  category("security", "Security", "security.cors_allowlist", "CORS allowlist"),
  category("notifications", "Notifications", "notifications.push.provider", "Push provider"),
  category("rate_limit", "Rate limits", "rate_limit.mobile_per_min", "Mobile per minute"),
];

const CURRENCIES = {
  ok: true as const,
  default: "EUR",
  currencies: [
    { code: "EUR", enabled: true, isDefault: true },
    { code: "USD", enabled: false, isDefault: false },
  ],
};

function props(section: string) {
  return { params: Promise.resolve({ section }) };
}

beforeEach(() => {
  notFoundMock.mockClear();
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadSettingsCategoriesMock.mockReset();
  loadSettingsCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES });
  loadCurrenciesMock.mockReset();
  loadCurrenciesMock.mockResolvedValue(CURRENCIES);
  settingsVisibilityMock.mockReset();
  settingsVisibilityMock.mockReturnValue({ restricted: [], readOnlyKeys: [] });
});

describe("SettingsSectionPage", () => {
  it.each([
    ["instance", "Instance", "Instance name"],
    ["localization", "Localization", "Timezone"],
    ["notifications", "Notifications", "Push provider"],
    ["rate-limits", "Rate limits", "Mobile per minute"],
  ])("renders only the %s category", async (slug, label, field) => {
    const html = renderToStaticMarkup(await SettingsSectionPage(props(slug)));

    expect(html).toContain(`<h1 class="text-base font-bold">${label}</h1>`);
    expect(html).toContain(`>Settings</a>`);
    expect(html).toContain(field);
    expect(html).toContain("Save changes");
    for (const other of ["Instance name", "Timezone", "CORS allowlist", "Push provider", "Mobile per minute"]) {
      if (other !== field) expect(html).not.toContain(other);
    }
  });

  it("renders the currencies picker only on localization", async () => {
    const localization = renderToStaticMarkup(await SettingsSectionPage(props("localization")));
    const instance = renderToStaticMarkup(await SettingsSectionPage(props("instance")));

    expect(localization).toContain('role="combobox"');
    expect(localization).toContain("Currencies available to this instance.");
    expect(localization).toContain("€ · Euro");
    expect(instance).not.toContain("Currencies available to this instance.");
  });

  it("refuses /panel/settings/security to an admin before reading any data", async () => {
    const html = renderToStaticMarkup(await SettingsSectionPage(props("security")));

    expect(html).toContain("You do not have access to this page.");
    expect(loadSettingsCategoriesMock).not.toHaveBeenCalled();
    expect(loadCurrenciesMock).not.toHaveBeenCalled();
  });

  it("renders security for a super_admin", async () => {
    requirePanelMock.mockResolvedValue({
      user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
    });

    const html = renderToStaticMarkup(await SettingsSectionPage(props("security")));

    expect(html).toContain('<h1 class="text-base font-bold">Security</h1>');
    expect(html).toContain("CORS allowlist");
    expect(settingsVisibilityMock).toHaveBeenCalledWith("super_admin");
  });

  it("calls notFound for a section that is not a real category", async () => {
    await expect(SettingsSectionPage(props("billing"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(loadSettingsCategoriesMock).not.toHaveBeenCalled();
  });

  it("keeps the section form when only the currencies read fails", async () => {
    loadCurrenciesMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-cur" });

    const html = renderToStaticMarkup(await SettingsSectionPage(props("localization")));

    expect(html).toContain("Save changes");
    expect(html).toContain("load the currencies.");
    expect(html).toContain("req-cur");
  });

  it("keeps the section header and retries the same section on a load error", async () => {
    loadSettingsCategoriesMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });

    const html = renderToStaticMarkup(await SettingsSectionPage(props("instance")));

    expect(html).toContain("load the settings.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/settings/instance"');
    expect(html).not.toContain("Save changes");
  });
});
