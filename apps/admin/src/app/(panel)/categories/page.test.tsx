import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadCategoriesMock = vi.fn();

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
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import CategoriesPage, { instant } from "./page";

const CATEGORIES = [
  {
    id: "c1",
    name: "Familia",
    slug: "familia",
    created_at: "2026-01-01T00:00:00.000Z",
    member_count: 2,
    modules: ["expenses"],
  },
  {
    id: "c2",
    name: "Amigos",
    slug: "amigos",
    created_at: "2026-01-02T00:00:00.000Z",
    member_count: 0,
    modules: [],
  },
];

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
  loadCategoriesMock.mockReset();
});

describe("CategoriesPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("lists name, slug, member count and module count with a link to the detail", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES });

    const html = renderToStaticMarkup(await CategoriesPage());

    expect(html).toContain("Familia");
    expect(html).toContain("familia");
    expect(html).toContain("Amigos");
    expect(html).toContain("amigos");
    expect(html).toContain('href="/categories/c1"');
    expect(html).toContain('href="/categories/c2"');
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('href="/categories/new"');
    expect(html).not.toContain("category-create-title");
  });

  it("shows the empty state with the create action", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: [] });

    const html = renderToStaticMarkup(await CategoriesPage());

    expect(html).toContain("No categories yet.");
    expect(html).toContain("Create category");
    expect(html).not.toContain("<table");
  });

  it("shows the error with the translated code, the request id and a retry link", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await CategoriesPage());

    expect(html).toContain("load the categories.");
    expect(html).toContain("Something went wrong on the server.");
    expect(html).toContain("req-500");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/categories"');
    expect(html).not.toContain("<table");
  });

  it("renders the generic 403 and never loads the list when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await CategoriesPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).toContain("Log out");
    expect(loadCategoriesMock).not.toHaveBeenCalled();
  });

  it("asks for the admin role", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: [] });

    await CategoriesPage();

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
  });
});
