import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadInvitationMock = vi.fn();
const loadCategoryMock = vi.fn();
const loadModuleChoicesMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
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
  loadInvitation: (id: string) => loadInvitationMock(id),
}));

vi.mock("@/lib/panel-categories", () => ({
  loadCategory: (id: string) => loadCategoryMock(id),
  loadModuleChoices: () => loadModuleChoicesMock(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import InvitationPage, { instant } from "./page";

const PENDING = {
  id: "i1",
  email: "ana@example.com",
  name: "Ana",
  user_category_id: "c1",
  modules: ["expenses", "notes"],
  status: "pending" as const,
  expires_at: "2026-12-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-11-01T00:00:00.000Z",
  created_by: { id: "u1", display_name: "Sara" },
};

const CATEGORY = {
  id: "c1",
  name: "Familia",
  slug: "familia",
  created_at: "2026-01-01T00:00:00.000Z",
  member_count: 2,
  modules: ["expenses"],
  members: [],
};

const MODULES = [
  { key: "expenses", name: "Expenses" },
  { key: "notes", name: "Notes" },
];

function render(id = "i1") {
  return InvitationPage({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadInvitationMock.mockReset();
  loadInvitationMock.mockResolvedValue({ ok: true, invitation: PENDING });
  loadCategoryMock.mockReset();
  loadCategoryMock.mockResolvedValue({ ok: true, category: CATEGORY });
  loadModuleChoicesMock.mockReset();
  loadModuleChoicesMock.mockResolvedValue({ ok: true, modules: MODULES });
  notFoundMock.mockClear();
});

describe("InvitationDetailPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("shows the breadcrumb, the email as heading and the status badge", async () => {
    const html = renderToStaticMarkup(await render());

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
    expect(html).toContain('href="/invitations"');
    expect(html).toContain("<h1");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Pending");
    expect(html).toMatch(/<section[^>]*invitation-revoke-title[^>]*rounded-card/);
    expect(loadInvitationMock).toHaveBeenCalledWith("i1");
  });

  it("shows the name, readable modules, dates and the creator", async () => {
    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Ana");
    // The invitation has no role: redeeming only creates `user` accounts.
    expect(html).not.toContain("Role");
    expect(html).not.toContain("Member");
    expect(html).toContain("Expenses");
    expect(html).toContain("Notes");
    expect(html).toContain("Expires");
    expect(html).toContain("Created");
    expect(html).toContain("Created by");
    expect(html).toContain("Sara");
  });

  it("links the category to its detail page", async () => {
    const html = renderToStaticMarkup(await render());

    expect(html).toContain('href="/categories/c1"');
    expect(html).toContain("Familia");
  });

  it("shows an em dash when the invitation has no category", async () => {
    loadInvitationMock.mockResolvedValue({
      ok: true,
      invitation: { ...PENDING, user_category_id: null },
    });

    const html = renderToStaticMarkup(await render());

    expect(loadCategoryMock).not.toHaveBeenCalled();
    expect(html).toContain("—");
  });

  it("falls back to the module key when the catalogue cannot name it", async () => {
    loadModuleChoicesMock.mockResolvedValue({ ok: false, code: "internal" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("expenses");
    expect(html).toContain("notes");
  });

  it("labels an invitation created by a key as the instance", async () => {
    loadInvitationMock.mockResolvedValue({
      ok: true,
      invitation: { ...PENDING, created_by: null },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Instance");
    expect(html).not.toContain("Sara");
  });

  it("treats a missing invitation as a real 404", async () => {
    loadInvitationMock.mockResolvedValue({ ok: false, code: "not_found" });

    await expect(render("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders the generic 403 without loading the invitation", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(loadInvitationMock).not.toHaveBeenCalled();
  });

  it("shows a load failure with the request id and a retry link", async () => {
    loadInvitationMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load this invitation");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/invitations/i1"');
  });

  it("offers revocation only while the invitation is pending", async () => {
    const pending = renderToStaticMarkup(await render());
    expect(pending).toContain("Revoke invitation for Ana");

    for (const status of ["used", "expired", "revoked"] as const) {
      loadInvitationMock.mockResolvedValue({
        ok: true,
        invitation: { ...PENDING, status },
      });
      const html = renderToStaticMarkup(await render());

      expect(html).toContain(status === "used" ? "Used" : status === "expired" ? "Expired" : "Revoked");
      expect(html).not.toContain("Revoke invitation for Ana");
      expect(html).not.toContain("Danger zone");
    }
  });

  it("explains where the link was shown instead of rendering it", async () => {
    const html = renderToStaticMarkup(await render());

    expect(html).toContain("only shown once");
    expect(html).not.toMatch(/token/i);
    expect(html).not.toContain("/redeem");
    expect(html).not.toContain("027_inv_");
  });

  it("shows the used and revoked dates when they apply", async () => {
    loadInvitationMock.mockResolvedValue({
      ok: true,
      invitation: {
        ...PENDING,
        status: "used" as const,
        used_at: "2026-11-02T00:00:00.000Z",
        revoked_at: "2026-11-03T00:00:00.000Z",
      },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Used");
    expect(html).toContain("Revoked");
  });
});
