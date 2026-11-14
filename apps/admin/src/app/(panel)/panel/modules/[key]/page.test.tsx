import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadModuleDetailMock = vi.fn();
const loadModuleSettingsMock = vi.fn();
const loadModuleGrantsMock = vi.fn();
const loadModuleJobRunsMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

const loadModuleManifestMock = vi.fn(async (_key: string): Promise<unknown> => null);

vi.mock("@/lib/module-manifests", () => ({
  loadModuleManifest: (key: string) => loadModuleManifestMock(key),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-settings", () => ({
  loadPanelTimeZone: async () => "UTC",
}));

vi.mock("@/lib/panel-modules", () => ({
  loadModuleDetail: (key: string) => loadModuleDetailMock(key),
  loadModuleSettings: (key: string) => loadModuleSettingsMock(key),
  loadModuleGrants: (key: string) => loadModuleGrantsMock(key),
  loadModuleJobRuns: (key: string) => loadModuleJobRunsMock(key),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import ModulePage, { instant } from "./page";

const MODULE = {
  key: "inventory",
  name: "Inventory",
  version: "1.0.0",
  state: "active" as const,
  is_public: false,
  mcp_exposed: "read" as const,
  manifest_digest: "d".repeat(64),
  installed_at: "2026-10-01T10:00:00.000Z",
  updated_at: "2026-10-02T10:00:00.000Z",
};

const SETTING = {
  category_key: "inventory",
  key: "inventory.low_stock_threshold",
  label: "Low stock threshold",
  help: null,
  value: 5,
  is_secret: false,
  configured: true,
  is_public: false,
  mcp_access: "none" as const,
  sort_order: 1,
  updated_at: "2026-10-02T10:00:00.000Z",
};

const SECRET_SETTING = {
  ...SETTING,
  key: "inventory.api_token",
  label: "API token",
  value: null,
  is_secret: true,
  configured: true,
};

const GRANTS = {
  users: [{ id: "u1", display_name: "Sara" }],
  categories: [{ id: "c1", name: "Family" }],
};

function render(key = "inventory") {
  return ModulePage({ params: Promise.resolve({ key }) });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "root@example.com", displayName: "Root", role: "super_admin" },
  });
  loadModuleDetailMock.mockReset();
  loadModuleDetailMock.mockResolvedValue({ ok: true, module: MODULE });
  loadModuleSettingsMock.mockReset();
  loadModuleSettingsMock.mockResolvedValue({ ok: true, settings: [SETTING] });
  loadModuleGrantsMock.mockReset();
  loadModuleGrantsMock.mockResolvedValue({ ok: true, grants: GRANTS });
  loadModuleJobRunsMock.mockReset();
  loadModuleJobRunsMock.mockResolvedValue({ ok: true, runs: [] });
  loadModuleManifestMock.mockReset();
  loadModuleManifestMock.mockResolvedValue(null);
  notFoundMock.mockClear();
});

describe("ModuleDetailPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("shows the breadcrumb, the heading, the state and the visibility badges", async () => {
    const html = renderToStaticMarkup(await render());

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
    expect(html).toContain('href="/panel/modules"');
    expect(html).toContain("<h1");
    expect(html).toContain("Inventory");
    expect(html).toContain("Active");
    expect(html).toContain("Private");
    expect(loadModuleDetailMock).toHaveBeenCalledWith("inventory");
    expect(loadModuleSettingsMock).toHaveBeenCalledWith("inventory");
    expect(loadModuleGrantsMock).toHaveBeenCalledWith("inventory");
  });

  it("marks a public module as public", async () => {
    loadModuleDetailMock.mockResolvedValue({ ok: true, module: { ...MODULE, is_public: true } });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Public");
    expect(html).not.toContain("Private");
  });

  it("shows key, version, the full digest, dates and the MCP exposure", async () => {
    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Key");
    expect(html).toContain("inventory");
    expect(html).toContain("Version");
    expect(html).toContain("1.0.0");
    expect(html).toContain("Manifest digest");
    expect(html).toContain(`title="${MODULE.manifest_digest}"`);
    expect(html).toContain("Installed");
    expect(html).toContain("Updated");
    expect(html).toContain("MCP exposure");
    expect(html).toContain("Read");
  });

  it("treats a missing module as a real 404", async () => {
    loadModuleDetailMock.mockResolvedValue({ ok: false, code: "not_found" });

    await expect(render("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
    expect(loadModuleSettingsMock).not.toHaveBeenCalled();
  });

  it("renders the generic 403 without loading the module", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "admin" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(loadModuleDetailMock).not.toHaveBeenCalled();
  });

  it("shows a load failure with the request id and a retry link", async () => {
    loadModuleDetailMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load this module");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/modules/inventory"');
  });

  it("offers Deactivate while the module is active", async () => {
    const html = renderToStaticMarkup(await render());

    expect(html).toContain(">Deactivate<");
    expect(html).not.toContain(">Activate<");
  });

  it.each(["installed", "disabled"] as const)("offers Activate while the module is %s", async (state) => {
    loadModuleDetailMock.mockResolvedValue({ ok: true, module: { ...MODULE, state } });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain(">Activate<");
    expect(html).not.toContain(">Deactivate<");
  });

  it("offers Uninstall with its own confirmation to a super_admin only", async () => {
    const html = renderToStaticMarkup(await render());
    expect(html).toContain(">Uninstall<");
    expect(html).toContain("Uninstall Inventory?");
    expect(html).toContain(">Uninstall module<");

    requirePanelMock.mockResolvedValue({
      user: { id: "u2", email: "admin@example.com", displayName: "Admin", role: "admin" },
    });
    const adminHtml = renderToStaticMarkup(await render());

    expect(adminHtml).not.toContain(">Uninstall<");
    expect(adminHtml).not.toContain("Uninstall Inventory?");
  });

  it("links every grant to its member and its category", async () => {
    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Grants");
    expect(html).toContain('href="/panel/members/u1"');
    expect(html).toContain("Sara");
    expect(html).toContain('href="/panel/categories/c1"');
    expect(html).toContain("Family");
  });

  it("explains an empty grant list instead of an empty box", async () => {
    loadModuleGrantsMock.mockResolvedValue({
      ok: true,
      grants: { users: [], categories: [] },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("No access has been granted yet.");
    expect(html).not.toContain('href="/panel/members/u1"');
  });

  it("renders an editable form for each setting, secrets as write-only", async () => {
    loadModuleSettingsMock.mockResolvedValue({
      ok: true,
      settings: [SETTING, SECRET_SETTING],
    });
    loadModuleManifestMock.mockResolvedValue({
      key: "inventory",
      version: "1.0.0",
      branding: { description: "Inventory", icon: "assets/icon.svg", color: "indigo" },
      settings: [
        {
          category: "inventory",
          label: "Inventory",
          sort_order: 10,
          settings: [
            {
              key: "low_stock_threshold",
              type: "int",
              min: 1,
              max: 20,
              step: 1,
              control: "slider",
              default: 5,
              label: "Low stock threshold",
              is_public: false,
              is_secret: false,
              mcp_access: "read",
              sort_order: 10,
            },
            {
              key: "api_token",
              type: "string",
              label: "API token",
              is_public: false,
              is_secret: true,
              mcp_access: "none",
              sort_order: 20,
            },
          ],
        },
      ],
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Low stock threshold");
    expect(html).toContain("API token");
    expect(html).toContain("name=\"value\"");
    // The int setting is a slider with its range from the manifest.
    expect(html).toContain('type="range"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="20"');
    // A secret is editable but never shows the stored value.
    expect(html).toContain('type="password"');
    expect(html).not.toContain("secret-value");
    expect(html).not.toContain('href="/panel/modules/inventory"');
  });

  it("offers an update only when the package is newer than the installed version", async () => {
    loadModuleManifestMock.mockResolvedValue({
      key: "inventory",
      version: "2.0.0",
      branding: { description: "Inventory", icon: "assets/icon.svg", color: "indigo" },
      admin_pages: [],
      settings: [],
    });

    const html = renderToStaticMarkup(await render());
    expect(html).toContain("Update");
    expect(html).toContain("v2.0.0");

    loadModuleManifestMock.mockResolvedValue({
      key: "inventory",
      version: "1.0.0",
      branding: { description: "Inventory", icon: "assets/icon.svg", color: "indigo" },
      admin_pages: [],
      settings: [],
    });
    const same = renderToStaticMarkup(await render());
    expect(same).not.toContain("v2.0.0");
  });

  it("explains an empty settings list", async () => {
    loadModuleSettingsMock.mockResolvedValue({ ok: true, settings: [] });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("This module has no settings.");
  });

  it("names the failing section when the settings cannot be loaded", async () => {
    loadModuleSettingsMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-set" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("req-set");
    expect(html).toContain("load the module settings.");
  });

  it("hides the grants section when the grants cannot be loaded", async () => {
    loadModuleGrantsMock.mockResolvedValue({
      ok: false,
      code: "insufficient_scope",
      requestId: "req-grants",
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("req-grants");
    expect(html).not.toContain('href="/panel/members/u1"');
  });
});
