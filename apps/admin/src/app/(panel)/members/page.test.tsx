import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadMembersMock = vi.fn();
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
  loadPanelTimeZone: async () => "UTC",
}));

vi.mock("@/lib/panel-members", () => ({
  MEMBERS_PAGE_SIZE: 20,
  loadMembers: (input: unknown) => loadMembersMock(input),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import MembersPage, { instant } from "./page";

const MEMBERS = [
  {
    id: "u1",
    display_name: "Ana",
    email: "ana@example.com",
    locale: "es",
    timezone: "Europe/Madrid",
    role: "super_admin" as const,
    created_at: "2026-01-01T00:00:00.000Z",
    deactivated_at: null,
  },
  {
    id: "u2",
    display_name: "Luis",
    email: "luis@example.com",
    locale: "en",
    timezone: "UTC",
    role: "user" as const,
    created_at: "2026-02-01T00:00:00.000Z",
    deactivated_at: "2026-03-01T00:00:00.000Z",
  },
];

function render(searchParams: Record<string, string> = {}) {
  return MembersPage({ searchParams: Promise.resolve(searchParams) });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadMembersMock.mockReset();
  redirectMock.mockClear();
});

describe("MembersPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("lists name, email, role and status for every member", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 2, activeTotal: 1 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Ana");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Super admin");
    expect(html).toContain("Active");
    expect(html).toContain("Luis");
    expect(html).toContain("luis@example.com");
    expect(html).toContain("User");
    expect(html).toContain("Deactivated");
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('href="/members/u1"');
    expect(html).toContain('href="/members/u2"');
  });

  it("shows the empty state with the invitation action when there are no members", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: [], total: 0, activeTotal: 0 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("No members yet.");
    expect(html).toContain("Invite a member");
    expect(html).toContain('href="/invitations"');
    expect(html).not.toContain("<table");
  });

  it("shows the empty state for a filter with no matches and lets the reader clear it", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: [], total: 0, activeTotal: 0 });

    const html = renderToStaticMarkup(await render({ q: "nobody" }));

    expect(html).toContain("No members match nobody.");
    expect(html).toContain("Clear search");
    expect(html).toContain('href="/members"');
    expect(loadMembersMock).toHaveBeenCalledWith({ q: "nobody", state: "active", offset: 0 });
  });

  it("shows the error with the translated code, the request id and a retry link", async () => {
    loadMembersMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load the members.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/members"');
    expect(html).not.toContain("<table");
  });

  it("paginates with the instance-wide total and links to the next page", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 45, activeTotal: 44 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Page 1 of 3");
    expect(html).toContain('href="/members?page=2"');
    expect(html).toContain("Next");
    expect(html).not.toContain('href="/members?page=0"');
  });

  it("keeps the filter in the pagination links", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 45, activeTotal: 44 });

    const html = renderToStaticMarkup(await render({ q: "ana", page: "2" }));

    expect(loadMembersMock).toHaveBeenCalledWith({ q: "ana", state: "active", offset: 20 });
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/members?q=ana"');
    expect(html).toContain('href="/members?q=ana&amp;page=3"');
  });

  it("redirects only when the requested page is past the last one", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: [], total: 40, activeTotal: 39 });

    await expect(render({ page: "3" })).rejects.toThrow("NEXT_REDIRECT:/members?page=2");
    expect(redirectMock).toHaveBeenCalledWith("/members?page=2");
    expect(loadMembersMock).toHaveBeenCalledWith({ state: "active", offset: 40 });
  });

  it("shows the empty state on the last page instead of redirecting in a loop", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: [], total: 40, activeTotal: 39 });

    const html = renderToStaticMarkup(await render({ page: "2" }));

    expect(html).toContain("No members yet.");
    expect(redirectMock).not.toHaveBeenCalled();
    expect(loadMembersMock).toHaveBeenCalledWith({ state: "active", offset: 20 });
  });

  it("renders a real GET filter form", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 2, activeTotal: 1 });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('id="members-q"');
    expect(html).toContain('name="role"');
    expect(html).toContain('id="members-role"');
    expect(html).toContain('name="state"');
    expect(html).toContain('id="members-state"');
    expect(html).toContain("All roles");
    expect(html).toContain("All states");
    expect(html).toContain("Search by name or email");
    expect(html).toContain(">Search<");
  });

  it("sends the role and state filters and keeps them in the pagination links", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 45, activeTotal: 44 });

    const html = renderToStaticMarkup(
      await render({ role: "user", state: "deactivated", page: "2" }),
    );

    expect(loadMembersMock).toHaveBeenCalledWith({
      role: "user",
      state: "deactivated",
      offset: 20,
    });
    expect(html).toContain('href="/members?role=user&amp;state=deactivated&amp;page=3"');
    expect(html).toContain('href="/members?role=user&amp;state=deactivated"');
  });

  it("combines the search with the filters in the query", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 45, activeTotal: 44 });

    const html = renderToStaticMarkup(await render({ q: "ana", role: "admin", state: "active" }));

    expect(loadMembersMock).toHaveBeenCalledWith({
      q: "ana",
      role: "admin",
      state: "active",
      offset: 0,
    });
    // Active is the default, so it stays out of the canonical URL.
    expect(html).toContain('href="/members?q=ana&amp;role=admin&amp;page=2"');
  });

  it("shows a filter-specific empty state and lets the reader clear every filter", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: [], total: 0, activeTotal: 0 });

    const html = renderToStaticMarkup(await render({ role: "admin", state: "active" }));

    expect(html).toContain("No members match this filter.");
    expect(html).toContain("Clear filters");
    expect(html).toContain('href="/members"');
  });

  it("ignores an unknown role or state instead of sending it to the API", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 2, activeTotal: 1 });

    await render({ role: "owner", state: "disabled" });

    expect(loadMembersMock).toHaveBeenCalledWith({ state: "active", offset: 0 });
  });

  it("renders the generic 403 and never loads the list when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(loadMembersMock).not.toHaveBeenCalled();
  });
});

describe("MembersPage filters", () => {
  it("applies role and state selects on change: only the text search keeps a submit button", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 2, activeTotal: 1 });

    const html = renderToStaticMarkup(await render({ role: "admin" }));

    expect(html).toContain('name="role"');
    expect(html).toContain('name="state"');
    expect(html).not.toContain(">Apply<");
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).toContain('<input type="hidden" name="role" value="admin"');
  });

  it("defaults to active even without a state parameter", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 2, activeTotal: 1 });

    const html = renderToStaticMarkup(await render());

    expect(loadMembersMock).toHaveBeenCalledWith({ state: "active", offset: 0 });
    expect(html).toContain('id="members-state"');
    expect(html).toContain('<option value="active" selected=""');
    expect(html).toContain('<option value="all"');
    expect(html).not.toContain('<input type="hidden" name="state"');
  });

  it("sends All as an explicit state=all and keeps it in the pagination", async () => {
    loadMembersMock.mockResolvedValue({ ok: true, users: MEMBERS, total: 45, activeTotal: 44 });

    const html = renderToStaticMarkup(await render({ state: "all", page: "2" }));

    expect(loadMembersMock).toHaveBeenCalledWith({ state: "all", offset: 20 });
    expect(html).toContain('<option value="all"');
    expect(html).toContain("All states");
    expect(html).toContain('<input type="hidden" name="state" value="all"');
    expect(html).toContain('href="/members?state=all&amp;page=3"');
    expect(html).toContain('href="/members?state=all"');
  });
});
