import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const loadModuleManifestMock = vi.fn();

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({ settingsDeps: { db: { query: queryMock } } }),
}));
vi.mock("@/lib/module-manifests", () => ({
  loadModuleManifest: (key: string) => loadModuleManifestMock(key),
}));

import { loadPanelModuleNav } from "./panel-module-nav";

const page = (role: "admin" | "super_admin") => ({
  route: "groups",
  label: "Groups",
  icon: "users",
  group: "module",
  role,
});

describe("panel module nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockResolvedValue({
      rows: [
        { key: "owe-no", name: "OweNo" },
        { key: "silent", name: "Silent" },
      ],
    });
  });

  it("lists active modules that ship a page the role can open", async () => {
    loadModuleManifestMock.mockImplementation(async (key: string) =>
      key === "owe-no"
        ? { key, name: "OweNo", branding: { color: "teal" }, admin_pages: [page("admin")] }
        : { key, name: "Silent", admin_pages: [] },
    );

    await expect(loadPanelModuleNav("admin")).resolves.toEqual([
      { key: "owe-no", name: "OweNo", color: "teal" },
    ]);
  });

  it("hides a super-admin-only page from an admin", async () => {
    loadModuleManifestMock.mockImplementation(async (key: string) =>
      key === "owe-no"
        ? { key, name: "OweNo", admin_pages: [page("super_admin")] }
        : { key, name: "Silent", admin_pages: [] },
    );

    await expect(loadPanelModuleNav("admin")).resolves.toEqual([]);
    const superAdmin = await loadPanelModuleNav("super_admin");
    expect(superAdmin.map((item) => item.key)).toEqual(["owe-no"]);
  });

  it("degrades to an empty menu when the registry is unreachable", async () => {
    queryMock.mockRejectedValue(new Error("down"));
    await expect(loadPanelModuleNav("admin")).resolves.toEqual([]);
  });
});
