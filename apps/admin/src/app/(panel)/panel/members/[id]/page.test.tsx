import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadMemberMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  usePathname: () => "/panel/members/m1",
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

vi.mock("@/lib/panel-members", () => ({
  loadMember: (id: string) => loadMemberMock(id),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import MemberPage, { instant } from "./page";

const MEMBER = {
  id: "u1",
  display_name: "Ana",
  email: "ana@example.com",
  locale: "es",
  timezone: "Europe/Madrid",
  role: "super_admin" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  deactivated_at: null,
  categories: [
    { id: "c1", name: "Alpha" },
    { id: "c2", name: "Beta" },
  ],
};

const DEACTIVATED = {
  ...MEMBER,
  deactivated_at: "2026-03-01T00:00:00.000Z",
};

const NO_CATEGORIES = {
  ...MEMBER,
  categories: [],
};

function render(id = "u1") {
  return MemberPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "super_admin" },
  });
  loadMemberMock.mockReset();
  notFoundMock.mockClear();
});

describe("MemberPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("shows the breadcrumb, the name, the email, the badges and the profile form", async () => {
    loadMemberMock.mockResolvedValue({ ok: true, member: MEMBER });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('href="/panel/members"');
    expect(html).toContain("<h1");
    expect(html).toContain("Ana");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Super admin");
    expect(html).toContain("Active");
    expect(html).toContain("Display name");
    expect(html).toContain("Time zone");
    expect(html).toContain("Save changes");
    expect(loadMemberMock).toHaveBeenCalledWith("u1");
  });

  it("offers the destructive action only to a super_admin acting on someone else", async () => {
    loadMemberMock.mockResolvedValue({ ok: true, member: MEMBER });
    requirePanelMock.mockResolvedValue({
      user: { id: "u2", email: "admin@example.com", displayName: "Admin", role: "super_admin" },
    });

    const asSuperAdmin = renderToStaticMarkup(await render());
    expect(asSuperAdmin).toContain("Deactivate member");
    expect(asSuperAdmin).toContain("Danger zone");

    requirePanelMock.mockResolvedValue({
      user: { id: "u2", email: "admin@example.com", displayName: "Admin", role: "admin" },
    });
    const asAdmin = renderToStaticMarkup(await render());
    expect(asAdmin).not.toContain("Deactivate member");
    expect(asAdmin).toContain("Only a super admin can change this role.");
  });

  it("offers reactivation only to a super_admin when the member is deactivated", async () => {
    loadMemberMock.mockResolvedValue({ ok: true, member: DEACTIVATED });
    requirePanelMock.mockResolvedValue({
      user: { id: "u2", email: "admin@example.com", displayName: "Admin", role: "super_admin" },
    });

    const asSuperAdmin = renderToStaticMarkup(await render());
    expect(asSuperAdmin).toContain("Reactivate member");
    expect(asSuperAdmin).toContain("Member access");
    expect(asSuperAdmin).toContain("Deactivated");
    expect(asSuperAdmin).toContain("Delete permanently");
    expect(asSuperAdmin).toContain("Danger zone");
    expect(asSuperAdmin).toContain("Type Ana to confirm");
    expect(asSuperAdmin).not.toContain("Deactivate member");

    requirePanelMock.mockResolvedValue({
      user: { id: "u2", email: "admin@example.com", displayName: "Admin", role: "admin" },
    });
    const asAdmin = renderToStaticMarkup(await render());
    expect(asAdmin).not.toContain("Reactivate member");
    expect(asAdmin).not.toContain("Delete permanently");
    expect(asAdmin).not.toContain("Danger zone");
  });

  it("offers permanent deletion only for a deactivated member, never on an active one", async () => {
    requirePanelMock.mockResolvedValue({
      user: { id: "u2", email: "admin@example.com", displayName: "Admin", role: "super_admin" },
    });
    loadMemberMock.mockResolvedValue({ ok: true, member: MEMBER });

    const active = renderToStaticMarkup(await render());
    expect(active).toContain("Deactivate member");
    expect(active).not.toContain("Delete permanently");

    loadMemberMock.mockResolvedValue({ ok: true, member: DEACTIVATED });
    const deactivated = renderToStaticMarkup(await render());
    expect(deactivated).toContain("Delete permanently");
    expect(deactivated).not.toContain("Deactivate member");
  });

  it("never offers self-destructive actions or a self role change", async () => {
    loadMemberMock.mockResolvedValue({ ok: true, member: MEMBER });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("This is your account.");
    expect(html).toContain("Display name");
    expect(html).not.toContain('id="member-role"');
    expect(html).not.toContain("Only a super admin can change this role.");
    expect(html).not.toContain("Danger zone");
    expect(html).not.toContain("Deactivate member");
  });

  it("renders the generic 403 and never loads the member when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(loadMemberMock).not.toHaveBeenCalled();
  });

  it("calls notFound() when the member does not exist", async () => {
    loadMemberMock.mockResolvedValue({ ok: false, code: "not_found", requestId: "req-404" });

    await expect(render("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadMemberMock).toHaveBeenCalledWith("missing");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("shows the error state with the request id and a retry link for other failures", async () => {
    loadMemberMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load this member.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/members/u1"');
    expect(html).not.toContain("Display name");
  });

  it("lists the categories of the member with links to each category", async () => {
    loadMemberMock.mockResolvedValue({ ok: true, member: MEMBER });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Categories");
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
    expect(html).toContain('href="/panel/categories/c1"');
    expect(html).toContain('href="/panel/categories/c2"');
  });

  it("links to the categories page when the member has none", async () => {
    loadMemberMock.mockResolvedValue({ ok: true, member: NO_CATEGORIES });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Categories");
    expect(html).toContain("No categories assigned.");
    expect(html).toContain('href="/panel/categories"');
  });
});
