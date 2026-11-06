import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getUserMock = vi.fn();
const queryMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({ settingsDeps: { db: { query: queryMock } } }),
}));

import { hasPanelRole, loadPanelUser, requirePanel, type PanelUser } from "./panel-guard";

const ADMIN: PanelUser = { id: "u-1", email: "a@b.co", displayName: "Ana", role: "admin" };

beforeEach(() => {
  redirectMock.mockClear();
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

  it("reads display name and role in a single profile query", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [{ display_name: "Ana", role: "admin" }] });

    await expect(loadPanelUser()).resolves.toEqual(ADMIN);
    expect(queryMock).toHaveBeenCalledTimes(1);
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
    queryMock.mockResolvedValue({ rows: [{ display_name: "Ana", role: "user" }] });

    await expect(requirePanel("admin")).resolves.toEqual({ denied: true });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns the user when the role meets the minimum", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1", email: "a@b.co" } } });
    queryMock.mockResolvedValue({ rows: [{ display_name: "Ana", role: "admin" }] });

    await expect(requirePanel("admin")).resolves.toEqual({ user: ADMIN });
  });
});
