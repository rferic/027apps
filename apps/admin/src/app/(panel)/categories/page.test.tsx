import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadCategoriesMock = vi.fn();
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

vi.mock("@/lib/panel-categories", () => ({
  loadCategories: (input: unknown) => loadCategoriesMock(input),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import CategoriesPage, { instant } from "./page";

/** Every anchor tag of a rendered fragment, to assert on attributes alone. */
function anchors(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
}

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
  redirectMock.mockClear();
});

describe("CategoriesPage", () => {
  it("opts the segment out of the static shell (the layout opt-out is not inherited)", () => {
    expect(instant).toBe(false);
  });

  it("lists name, slug, member count and module count with a link to the detail", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES, total: 2 });

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

  it("stretches the row link over the whole row of a separate-border table", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES, total: 2 });

    const html = renderToStaticMarkup(await CategoriesPage());
    const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    const rowLinks = anchors(table).filter((tag) => tag.includes("after:absolute"));

    expect(table).toContain("border-separate");
    expect(rowLinks).toHaveLength(2);
    expect(rowLinks[0]).toContain('href="/categories/c1"');
    expect(rowLinks[1]).toContain('href="/categories/c2"');
  });

  it("keeps the mobile card as a single block link", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: [CATEGORIES[0]], total: 1 });

    const html = renderToStaticMarkup(await CategoriesPage());
    const cards = html.slice(html.indexOf("</table>"));
    const card = anchors(cards).find((tag) => tag.includes('href="/categories/c1"'));

    expect(card).toBeDefined();
    expect(card).toContain("flex min-h-11 flex-col");
  });

  it("shows the empty state with the create action", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: [], total: 0 });

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
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: [], total: 0 });

    await CategoriesPage();

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
  });

  it("paginates with a fixed page size and keeps the search in the links", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES, total: 45 });

    const html = renderToStaticMarkup(
      await CategoriesPage({ searchParams: Promise.resolve({ page: "2", q: "fam" }) }),
    );

    expect(loadCategoriesMock).toHaveBeenCalledWith({ offset: 20 });
    expect(html).toContain("Page 2 of 3");
    expect(html).toContain('href="/categories?q=fam"');
    expect(html).toContain('href="/categories?q=fam&amp;page=3"');
  });

  it("keeps the pagination visible and disabled when there is a single page", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES, total: 2 });

    const html = renderToStaticMarkup(await CategoriesPage());

    expect(html).toContain("Page 1 of 1");
    expect(html).toContain('aria-disabled="true"');
  });

  it("filters the current page by name or slug without another API call", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES, total: 2 });

    const html = renderToStaticMarkup(
      await CategoriesPage({ searchParams: Promise.resolve({ q: "amig" }) }),
    );

    expect(html).toContain("Amigos");
    expect(html).not.toContain("Familia");
    expect(loadCategoriesMock).toHaveBeenCalledTimes(1);
    expect(loadCategoriesMock).toHaveBeenCalledWith({ offset: 0 });
  });

  it("searches while typing: the field keeps its name and there is no search button", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: CATEGORIES, total: 2 });

    const html = renderToStaticMarkup(
      await CategoriesPage({ searchParams: Promise.resolve({ q: "fam" }) }),
    );

    expect(html).toContain('name="q"');
    expect(html).toContain('value="fam"');
    expect(html).toContain('role="search"');
    expect(html).toContain("Search by name or slug");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain(">Search<");
    expect(html).toContain('aria-label="Clear search"');
  });

  it("redirects only when the requested page is past the last one", async () => {
    loadCategoriesMock.mockResolvedValue({ ok: true, categories: [], total: 40 });

    await expect(
      CategoriesPage({ searchParams: Promise.resolve({ page: "3" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/categories?page=2");
    expect(redirectMock).toHaveBeenCalledWith("/categories?page=2");
  });
});
