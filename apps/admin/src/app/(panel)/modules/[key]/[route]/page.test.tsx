import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadModuleDetailMock = vi.fn();
const loadModuleManifestMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  redirect: (href: string) => redirectMock(href),
}));

vi.mock("@/lib/panel-guard", () => ({ requirePanel: () => requirePanelMock() }));
vi.mock("@/lib/panel-modules", () => ({ loadModuleDetail: (key: string) => loadModuleDetailMock(key) }));
vi.mock("@/lib/module-manifests", () => ({
  loadModuleManifest: (key: string) => loadModuleManifestMock(key),
}));
vi.mock("@/lib/panel-locale", () => ({ panelLocale: () => "en" }));
vi.mock("@/lib/panel-i18n", () => ({ loadPanelMessages: async () => ({}) }));
vi.mock("@/components/panel-forbidden", () => ({
  PanelForbidden: () => <p>forbidden</p>,
}));

import ModuleAdminPage from "./page";

const admin = { user: { role: "admin", id: "u1" } };

const overviewPage = { route: "overview", label: "Overview", icon: "box", group: "module", role: "admin" };

function manifest(pages: unknown[] = [overviewPage]) {
  return { key: "fixture", admin_pages: pages };
}

function detail(state: string) {
  return { ok: true, module: { key: "fixture", name: "Fixture", state } };
}

const params = (route = "overview") => ({ params: Promise.resolve({ key: "fixture", route }) });

describe("module admin page host", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePanelMock.mockResolvedValue(admin);
    loadModuleManifestMock.mockResolvedValue(manifest());
    loadModuleDetailMock.mockResolvedValue(detail("active"));
  });

  it("renders a declared page of an active module", async () => {
    const html = renderToStaticMarkup(await ModuleAdminPage(params()));
    expect(html).toContain("Fixture");
    expect(html).toContain("/modules/fixture/settings");
  });

  it("404s a route the manifest does not declare", async () => {
    await expect(ModuleAdminPage(params("imports"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends an inactive module to its settings page, where it can be activated", async () => {
    loadModuleDetailMock.mockResolvedValue(detail("installed"));
    await expect(ModuleAdminPage(params())).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/modules/fixture/settings");
  });

  it("404s when the package has no component for a declared route", async () => {
    loadModuleManifestMock.mockResolvedValue(
      manifest([{ route: "ghost", label: "Ghost", icon: "box", group: "module", role: "admin" }]),
    );
    await expect(ModuleAdminPage(params("ghost"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("forbids a super_admin page to an admin", async () => {
    loadModuleManifestMock.mockResolvedValue(
      manifest([{ route: "overview", label: "Overview", icon: "box", group: "module", role: "super_admin" }]),
    );
    const html = renderToStaticMarkup(await ModuleAdminPage(params()));
    expect(html).toContain("forbidden");
  });
});
