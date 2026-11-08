import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadInvitationsMock = vi.fn();
const loadCategoriesMock = vi.fn();
const loadModuleChoicesMock = vi.fn();
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

vi.mock("@/lib/panel-invitations", () => ({
  loadInvitations: (input: unknown) => loadInvitationsMock(input),
}));

vi.mock("@/lib/panel-categories", () => ({
  loadCategories: (input: unknown) => loadCategoriesMock(input),
  loadModuleChoices: () => loadModuleChoicesMock(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import InvitationsPage, { instant } from "./page";

const PENDING = {
  id: "i1",
  email: "ana@example.com",
  name: "Ana",
  user_category_id: "c1",
  modules: ["expenses"],
  status: "pending" as const,
  expires_at: "2026-12-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-11-01T00:00:00.000Z",
};

const USED = {
  ...PENDING,
  id: "i2",
  email: "luis@example.com",
  name: "Luis",
  user_category_id: null,
  modules: [],
  status: "used" as const,
  used_at: "2026-11-02T00:00:00.000Z",
};

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadInvitationsMock.mockReset();
  loadCategoriesMock.mockReset();
  loadCategoriesMock.mockResolvedValue({
    ok: true,
    categories: [
      {
        id: "c1",
        name: "Familia",
        slug: "familia",
        created_at: "2026-01-01T00:00:00.000Z",
        member_count: 1,
        modules: ["expenses"],
      },
    ],
    total: 1,
  });
  loadModuleChoicesMock.mockReset();
  loadModuleChoicesMock.mockResolvedValue({
    ok: true,
    modules: [{ key: "expenses", name: "Expenses" }],
  });
  redirectMock.mockClear();
});

describe("InvitationsPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("lists email, name, status, category, modules and expiry", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING, USED], total: 2 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("ana@example.com");
    expect(html).toContain("Ana");
    expect(html).toContain("Pending");
    expect(html).toContain("luis@example.com");
    expect(html).toContain("Luis");
    expect(html).toContain("Used");
    expect(html).toContain("Familia");
    expect(html).toContain("Expenses");
    expect(html).toContain("Expires");
    expect(html).toContain("<caption");
    expect(html).toContain("Invitations you have created.");
    expect(html).toContain('href="/invitations/new"');
    expect(html).not.toContain("invitation-create-title");
  });

  it("renders a status as text, not only as a colour", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 1 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain(">Pending<");
  });

  it("offers revocation only for a pending invitation", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING, USED], total: 2 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("Revoke invitation for Ana");
    expect(html).not.toContain("Revoke invitation for Luis");
  });

  it("renders expired and revoked states without offering revocation", async () => {
    loadInvitationsMock.mockResolvedValue({
      ok: true,
      invitations: [
        {
          ...PENDING,
          id: "i3",
          email: "eve@example.com",
          name: "Eve",
          status: "expired" as const,
          expires_at: "2025-01-01T00:00:00.000Z",
        },
        {
          ...PENDING,
          id: "i4",
          email: "ruth@example.com",
          name: "Ruth",
          status: "revoked" as const,
          revoked_at: "2026-11-03T00:00:00.000Z",
        },
      ],
      total: 2,
    });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("Expired");
    expect(html).toContain("Revoked");
    expect(html).not.toContain("Revoke invitation for Eve");
    expect(html).not.toContain("Revoke invitation for Ruth");
  });

  it("shows an em dash for an invitation without a category", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [USED], total: 1 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("—");
  });

  it("does not read a failed category list as 'no category'", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 1 });
    loadCategoriesMock.mockResolvedValue({ ok: false, code: "internal" });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("Category unavailable");
  });

  it("shows the empty state with the create action", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [], total: 0 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("No invitations yet.");
    expect(html).toContain("Create invitation");
    expect(html).not.toContain("<table");
  });

  it("shows the error with the translated code, the request id and a retry link", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("load the invitations.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/invitations"');
  });

  it("renders the generic 403 and never loads the list when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(loadInvitationsMock).not.toHaveBeenCalled();
  });

  it("links the empty state to the create page instead of opening a dialog", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [], total: 0 });
    loadCategoriesMock.mockResolvedValue({ ok: false, code: "internal" });
    loadModuleChoicesMock.mockResolvedValue({ ok: false, code: "internal" });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("No invitations yet.");
    expect(html).toContain('href="/invitations/new"');
    expect(html).not.toContain("invitation-create-title");
  });

  it("paginates with a fixed page size and keeps the status filter in the links", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 45 });

    const html = renderToStaticMarkup(
      await InvitationsPage({ searchParams: Promise.resolve({ page: "2", status: "used" }) }),
    );

    expect(loadInvitationsMock).toHaveBeenCalledWith({ offset: 20, status: "used" });
    expect(loadCategoriesMock).toHaveBeenCalledWith({ offset: 0, limit: 100 });
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/invitations?status=used"');
    expect(html).toContain('href="/invitations?status=used&amp;page=3"');
  });

  it("starts on pending when the URL carries no status", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 1 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(loadInvitationsMock).toHaveBeenCalledWith({ offset: 0, status: "pending" });
    expect(html).toContain('id="invitations-status"');
  });

  it("sends All as an explicit status=all and keeps it in the pagination", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 45 });

    const html = renderToStaticMarkup(
      await InvitationsPage({ searchParams: Promise.resolve({ status: "all", page: "2" }) }),
    );

    expect(loadInvitationsMock).toHaveBeenCalledWith({ offset: 20, status: "all" });
    expect(html).toContain('href="/invitations?status=all"');
    expect(html).toContain('href="/invitations?status=all&amp;page=3"');
  });

  it("offers All as a real option that is never the empty value", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 1 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain('<option value="all"');
    expect(html).not.toContain('<option value=""');
  });

  it("keeps the pagination visible and disabled on a single page", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 1 });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("Page 1 of 1");
    expect(html).toContain('aria-disabled="true"');
  });

  it("asks the Core for the selected status instead of filtering the page", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [USED], total: 1 });

    const html = renderToStaticMarkup(
      await InvitationsPage({ searchParams: Promise.resolve({ status: "used" }) }),
    );

    expect(loadInvitationsMock).toHaveBeenCalledTimes(1);
    expect(loadInvitationsMock).toHaveBeenCalledWith({ offset: 0, status: "used" });
    expect(html).toContain("luis@example.com");
  });

  it("redirects only when the requested page is past the last one", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [], total: 40 });

    await expect(
      InvitationsPage({ searchParams: Promise.resolve({ page: "3", status: "used" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/invitations?status=used&page=2");
  });

  it("keeps the default pending out of the canonical URL when redirecting", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [], total: 40 });

    await expect(InvitationsPage({ searchParams: Promise.resolve({ page: "3" }) })).rejects.toThrow(
      "NEXT_REDIRECT:/invitations?page=2",
    );
  });
});

describe("InvitationsPage filters", () => {
  it("applies the status select on change: no Apply button and the select is named", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING], total: 1 });

    const html = renderToStaticMarkup(
      await InvitationsPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('name="status"');
    expect(html).not.toContain(">Apply<");
    expect(html).not.toContain("<button type=\"submit\"");
  });
});
