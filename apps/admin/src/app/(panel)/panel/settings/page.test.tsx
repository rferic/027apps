import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadSettingsCategoriesMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
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
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import SettingsIndexPage, { instant } from "./page";

function category(categoryKey: string, label: string, key: string, settingLabel: string) {
  return {
    categoryKey,
    label,
    help: "",
    icon: "server",
    sortOrder: 10,
    settings: [
      {
        key,
        category: categoryKey,
        label: settingLabel,
        help: "",
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
  };
}

const SECURITY = category("security", "Security", "security.jwt_expiry", "JWT expiry");
const INSTANCE = category("instance", "Instance", "instance.name", "Instance name");
const LOCALIZATION = category(
  "localization",
  "Localization",
  "localization.timezone",
  "Timezone",
);

beforeEach(() => {
  redirectMock.mockClear();
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadSettingsCategoriesMock.mockReset();
  loadSettingsCategoriesMock.mockResolvedValue({
    ok: true,
    categories: [SECURITY, INSTANCE, LOCALIZATION],
  });
});

describe("SettingsIndexPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("redirects an admin to the first section it can see (skips security)", async () => {
    await expect(SettingsIndexPage()).rejects.toThrow("NEXT_REDIRECT:/panel/settings/instance");
    expect(redirectMock).toHaveBeenCalledWith("/panel/settings/instance");
    expect(loadSettingsCategoriesMock).toHaveBeenCalledTimes(1);
  });

  it("redirects a super_admin to the first visible category from the API order", async () => {
    requirePanelMock.mockResolvedValue({
      user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
    });

    await expect(SettingsIndexPage()).rejects.toThrow("NEXT_REDIRECT:/panel/settings/security");
    expect(redirectMock).toHaveBeenCalledWith("/panel/settings/security");
  });

  it("falls back to the canonical first section when the categories read fails", async () => {
    loadSettingsCategoriesMock.mockResolvedValue({ ok: false, code: "internal" });

    await expect(SettingsIndexPage()).rejects.toThrow("NEXT_REDIRECT:/panel/settings/instance");
  });

  it("renders the generic 403 and never loads data when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await SettingsIndexPage());

    expect(html).toContain("You do not have access to this page.");
    expect(loadSettingsCategoriesMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
