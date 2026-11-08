import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadUserModulesMock = vi.fn();

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-user-modules", () => ({
  loadUserModules: (userId: string) => loadUserModulesMock(userId),
}));

import { loadUserModulesAction } from "./actions";

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "root", email: "root@example.test", displayName: "Root", role: "super_admin" },
  });
  loadUserModulesMock.mockReset();
  loadUserModulesMock.mockResolvedValue({ ok: true, modules: [] });
});

describe("loadUserModulesAction", () => {
  it("refuses a panel admin before reaching the API", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "admin", email: "a@example.test", displayName: "Ana", role: "admin" },
    });

    await expect(loadUserModulesAction("u1")).resolves.toEqual({
      ok: false,
      code: "insufficient_scope",
    });

    expect(requirePanelMock).toHaveBeenCalledWith("super_admin");
    expect(loadUserModulesMock).not.toHaveBeenCalled();
  });

  it("loads the owner's modules for a super_admin session", async () => {
    loadUserModulesMock.mockResolvedValue({
      ok: true,
      modules: [{ key: "recetas", name: "Recetas" }],
    });

    await expect(loadUserModulesAction("u1")).resolves.toEqual({
      ok: true,
      modules: [{ key: "recetas", name: "Recetas" }],
    });
    expect(loadUserModulesMock).toHaveBeenCalledWith("u1");
  });
});
