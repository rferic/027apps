import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const connectionMock = vi.fn(async () => {});
const getUserMock = vi.fn();
const queryMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/server", () => ({
  connection: () => connectionMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({ settingsDeps: { db: { query: queryMock } } }),
}));

import { hasPanelRole, loadPanelUser, requirePanel, type PanelUser } from "./panel-guard";

const ADMIN: PanelUser = {
  id: "u-1",
  email: "a@b.co",
  displayName: "Ana",
  role: "admin",
  locale: "es",
  theme: "system",
};

beforeEach(() => {
  redirectMock.mockClear();
  connectionMock.mockClear();
  getUserMock.mockReset();
  queryMock.mockReset();
});

describe("loadPanelUser", () => {
  it("returns null without a session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await expect(loadPanelUser()).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns null when the profile is deactivated (no row)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [] });

    await expect(loadPanelUser()).resolves.toBeNull();
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("deactivated_at is null"), ["u-1"]);
  });

  it("reads display name, role and appearance in a single profile query", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({
      rows: [{ display_name: "Ana", role: "admin", locale: "es", theme: "system" }],
    });

    await expect(loadPanelUser()).resolves.toEqual(ADMIN);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the stored per-user theme and locale", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({
      rows: [{ display_name: "Ana", role: "admin", locale: "ca", theme: "dark" }],
    });

    await expect(loadPanelUser()).resolves.toMatchObject({ locale: "ca", theme: "dark" });
  });

  it("falls back when the stored preferences are unknown", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({
      rows: [{ display_name: "Ana", role: "admin", locale: "xx", theme: "neon" }],
    });

    await expect(loadPanelUser()).resolves.toMatchObject({ locale: "en", theme: "system" });
  });
});

describe("hasPanelRole", () => {
  it("ranks super_admin above admin and user", () => {
    const superAdmin: PanelUser = { ...ADMIN, role: "super_admin" };
    const user: PanelUser = { ...ADMIN, role: "user" };

    expect(hasPanelRole(superAdmin, "admin")).toBe(true);
    expect(hasPanelRole(superAdmin, "super_admin")).toBe(true);
    expect(hasPanelRole(ADMIN, "admin")).toBe(true);
    expect(hasPanelRole(ADMIN, "super_admin")).toBe(false);
    expect(hasPanelRole(user, "admin")).toBe(false);
  });
});

describe("requirePanel", () => {
  it("waits for the request before reading the session (never prerenders Date.now)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [{ display_name: "Ana", role: "admin", locale: "es", theme: "system" }] });

    await requirePanel("admin");

    expect(connectionMock).toHaveBeenCalledTimes(1);
    expect(connectionMock.mock.invocationCallOrder[0]).toBeLessThan(
      getUserMock.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("redirects to /login without a session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await expect(requirePanel("admin")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when the profile is deactivated", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [] });

    await expect(requirePanel("admin")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("denies a user role below the minimum", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [{ display_name: "Ana", role: "user", locale: "es", theme: "system" }] });

    await expect(requirePanel("admin")).resolves.toEqual({
      denied: true,
      user: { ...ADMIN, role: "user" },
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns the user when the role meets the minimum", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [{ display_name: "Ana", role: "admin", locale: "es", theme: "system" }] });

    await expect(requirePanel("admin")).resolves.toEqual({ user: ADMIN });
  });
});
