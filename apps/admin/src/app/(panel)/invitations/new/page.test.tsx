import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
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

vi.mock("@/lib/panel-categories", () => ({
  loadCategories: () => loadCategoriesMock(),
  loadModuleChoices: () => loadModuleChoicesMock(),
}));

import NewInvitationPage, { instant } from "./page";

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
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
});

describe("NewInvitationPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("renders the breadcrumb, title, back link and the form with its options", async () => {
    const html = renderToStaticMarkup(await NewInvitationPage());

    expect(html).toContain("Breadcrumb");
    expect(html).toContain("New invitation");
    expect(html).toContain("Back");
    expect(html).toContain('href="/invitations"');
    expect(html).toContain("invitation-email");
    expect(html).toContain("Familia");
    expect(html).toContain("Expenses");
    expect(html).not.toContain("<dialog");
  });

  it("keeps the form usable when the option reads fail", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: false, code: "internal" });
    loadModuleChoicesMock.mockResolvedValue({ ok: false, code: "internal" });

    const html = renderToStaticMarkup(await NewInvitationPage());

    expect(html).toContain("invitation-email");
    expect(html).toContain("Some category or module options are unavailable right now.");
  });

  it("renders the generic 403 and no form when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await NewInvitationPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).not.toContain("invitation-email");
    expect(loadCategoriesMock).not.toHaveBeenCalled();
  });
});
