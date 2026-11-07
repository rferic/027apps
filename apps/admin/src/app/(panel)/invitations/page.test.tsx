import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadInvitationsMock = vi.fn();
const loadCategoriesMock = vi.fn();
const loadModuleChoicesMock = vi.fn();

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

vi.mock("@/lib/panel-invitations", () => ({
  loadInvitations: () => loadInvitationsMock(),
}));

vi.mock("@/lib/panel-categories", () => ({
  loadCategories: () => loadCategoriesMock(),
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
  });
  loadModuleChoicesMock.mockReset();
  loadModuleChoicesMock.mockResolvedValue({
    ok: true,
    modules: [{ key: "expenses", name: "Expenses" }],
  });
});

describe("InvitationsPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("lists email, name, status, category, modules and expiry", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING, USED] });

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
  });

  it("renders a status as text, not only as a colour", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING] });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain(">Pending<");
  });

  it("offers revocation only for a pending invitation", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [PENDING, USED] });

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
    });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("Expired");
    expect(html).toContain("Revoked");
    expect(html).not.toContain("Revoke invitation for Eve");
    expect(html).not.toContain("Revoke invitation for Ruth");
  });

  it("shows an em dash for an invitation without a category", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [USED] });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("—");
  });

  it("shows the empty state with the create action", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [] });

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

  it("keeps the create form usable when the category or module pickers fail", async () => {
    loadInvitationsMock.mockResolvedValue({ ok: true, invitations: [] });
    loadCategoriesMock.mockResolvedValue({ ok: false, code: "internal" });
    loadModuleChoicesMock.mockResolvedValue({ ok: false, code: "internal" });

    const html = renderToStaticMarkup(await InvitationsPage());

    expect(html).toContain("No invitations yet.");
    expect(html).toContain("Create invitation");
    expect(html).toContain("Some category or module options are unavailable right now.");
  });
});
