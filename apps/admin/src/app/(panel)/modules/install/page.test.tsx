import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const listModulePackagesMock = vi.fn();
const loadModulesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/module-packages", () => ({
  listModulePackages: () => listModulePackagesMock(),
}));

vi.mock("@/lib/panel-modules", () => ({
  loadModules: (input: unknown) => loadModulesMock(input),
}));

vi.mock("@/app/(panel)/modules/install/actions", () => ({
  installModuleAction: vi.fn(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import InstallModulePage, { instant } from "./page";

const PACKAGES = [
  {
    id: "notes",
    key: "notes",
    name: "Notes",
    version: "1.2.0",
    description: "Shared notes for the household",
    valid: true,
  },
  {
    id: "debug",
    key: "debug",
    name: "Debug",
    version: "0.1.0",
    description: "Diagnostics",
    valid: true,
  },
  {
    id: "broken",
    key: "broken",
    name: "Broken",
    version: "broken",
    description: "broken",
    valid: false,
    reason: "invalid_manifest",
  },
  {
    id: "stock",
    key: "stock-inventory",
    name: "Stock",
    version: "1.0.0",
    description: "Stock control",
    valid: false,
    reason: "key_mismatch",
  },
];

/** Only the installed keys matter here; the page never renders the rest. */
function installed(keys: string[]) {
  return {
    ok: true,
    modules: keys.map((key) => ({ key })),
    total: keys.length,
  };
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  listModulePackagesMock.mockReset();
  listModulePackagesMock.mockResolvedValue(PACKAGES);
  loadModulesMock.mockReset();
  loadModulesMock.mockResolvedValue(installed(["debug"]));
});

describe("InstallModulePage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("shows the breadcrumb, the heading and the server-only explanation", async () => {
    const html = renderToStaticMarkup(await InstallModulePage());

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
    expect(html).toContain('href="/modules"');
    expect(html).toContain("<h1");
    expect(html).toContain("Install a module");
    expect(html).toContain("Only packages already present on the server can be installed.");
    expect(html).toContain("<table");
    expect(html).toContain('class="flex flex-col gap-4 rounded-card border border-border bg-surface p-4"');
  });

  it("lists the available packages with their metadata and an Install button", async () => {
    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).toContain("Notes");
    expect(html).toContain("notes");
    expect(html).toContain("1.2.0");
    expect(html).toContain("Shared notes for the household");
    expect(html).toContain("Install");
    expect(loadModulesMock).toHaveBeenCalledWith({ offset: 0, limit: 100 });
  });

  it("hides the packages that are already installed", async () => {
    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).not.toContain("Debug");
    expect(html).not.toContain(">debug<");
    expect(html).toContain("Notes");
  });

  it("matches an installed module by folder, not by the folder's manifest claim", async () => {
    loadModulesMock.mockResolvedValue(installed(["stock"]));

    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).not.toContain("stock-inventory");
    expect(html).toContain("Notes");
  });

  it("shows invalid packages disabled with the reason", async () => {
    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).toContain("Broken");
    expect(html).toContain("This package&#x27;s manifest is not valid.");
    expect(html).toContain("The package folder and the manifest key do not match.");
    expect(html).toContain("disabled");
  });

  it("shows the empty state with a way back when nothing can be installed", async () => {
    loadModulesMock.mockResolvedValue(installed(["debug", "notes", "broken", "stock"]));

    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).toContain("No packages are available to install.");
    expect(html).toContain("Back to modules");
    expect(html).not.toContain("<table");
  });

  it("renders the generic 403 without reading the packages", async () => {
    requirePanelMock.mockResolvedValue({ denied: true });

    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(html).not.toContain("Install a module");
    expect(listModulePackagesMock).not.toHaveBeenCalled();
    expect(loadModulesMock).not.toHaveBeenCalled();
  });

  it("shows a load error instead of an empty installer when the catalogue fails", async () => {
    loadModulesMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await InstallModulePage());

    expect(html).toContain("We couldn&#x27;t load the module catalogue.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).not.toContain("No packages are available to install.");
    expect(html).not.toContain("<table");
  });
});
