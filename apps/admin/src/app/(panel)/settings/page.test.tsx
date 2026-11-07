import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadSettingsCategoriesMock = vi.fn();
const loadCurrenciesMock = vi.fn();
const settingsVisibilityMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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

import SettingsPage, { instant } from "./page";

const CATEGORIES = [
  {
    categoryKey: "instance",
    label: "Instance",
    help: "Instance identity and public links.",
    icon: "server",
    sortOrder: 10,
    settings: [
      {
        key: "instance.name",
        category: "instance",
        label: "Instance name",
        help: "Public name of this 027Apps instance.",
        type: "string" as const,
        isSecret: false,
        isPublic: true,
        superAdminOnly: false,
        readOnly: false,
        sortOrder: 10,
        updatedBy: null,
        updatedAt: "2026-11-01T10:00:00.000Z",
        value: "027Apps",
      },
    ],
  },
];

const CURRENCIES = {
  ok: true as const,
  default: "EUR",
  currencies: [
    { code: "EUR", enabled: true, isDefault: true },
    { code: "USD", enabled: false, isDefault: false },
  ],
};

const VISIBILITY = {
  restricted: [
    {
      key: "instance.public_url",
      category: "instance",
      label: "Public URL",
      help: "https origin used for invitation links and deep links.",
      readOnly: false,
    },
  ],
  readOnlyKeys: ["security.jwt_expiry"],
};

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadSettingsCategoriesMock.mockReset();
  loadSettingsCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES });
  loadCurrenciesMock.mockReset();
  loadCurrenciesMock.mockResolvedValue(CURRENCIES);
  settingsVisibilityMock.mockReset();
  settingsVisibilityMock.mockReturnValue(VISIBILITY);
});

describe("SettingsPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("groups settings by category and shows currencies", async () => {
    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain("Instance");
    expect(html).toContain("Instance name");
    expect(html).toContain("Save changes");
    expect(html).toContain("Currencies");
    expect(html).toContain("USD");
    expect(settingsVisibilityMock).toHaveBeenCalledWith("admin");
  });

  it("composes the super-admin-only rows as read-only notes for an admin", async () => {
    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain("Public URL");
    expect(html).toContain("Only a super administrator can view this value.");
    expect(html).not.toContain('id="setting-instance-public_url"');
  });

  it("shows no restricted rows for a super_admin", async () => {
    requirePanelMock.mockResolvedValue({
      user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
    });
    settingsVisibilityMock.mockReturnValue({ restricted: [], readOnlyKeys: ["security.jwt_expiry"] });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).not.toContain("Only a super administrator can view this value.");
    expect(settingsVisibilityMock).toHaveBeenCalledWith("super_admin");
  });

  it("shows the settings error with the request id and a retry link", async () => {
    loadSettingsCategoriesMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain("load the settings.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain("Save changes");
  });

  it("keeps the settings form when only the currencies read fails", async () => {
    loadCurrenciesMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-cur" });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain("Save changes");
    expect(html).toContain("load the currencies.");
    expect(html).toContain("req-cur");
  });

  it("renders the generic 403 and never loads data when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await SettingsPage());

    expect(html).toContain("You do not have access to this page.");
    expect(loadSettingsCategoriesMock).not.toHaveBeenCalled();
    expect(loadCurrenciesMock).not.toHaveBeenCalled();
  });
});
