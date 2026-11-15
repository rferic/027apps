import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();
const loadCategoryMock = vi.fn();
const loadMemberChoicesMock = vi.fn();
const loadModuleChoicesMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  usePathname: () => "/panel/categories/c1",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/panel-guard", () => ({
  requirePanel: (min: string) => requirePanelMock(min),
}));

vi.mock("@/lib/panel-i18n", () => ({
  loadPanelMessages: async () => ({}),
}));

vi.mock("@/lib/panel-categories", () => ({
  MEMBER_CHOICES_LIMIT: 100,
  loadCategory: (id: string) => loadCategoryMock(id),
  loadMemberChoices: (input: unknown) => loadMemberChoicesMock(input),
  loadModuleChoices: () => loadModuleChoicesMock(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  signOutAction: "sign-out",
}));

import CategoryPage, { instant } from "./page";

const CATEGORY = {
  id: "c1",
  name: "Familia",
  slug: "familia",
  created_at: "2026-01-01T00:00:00.000Z",
  member_count: 1,
  modules: ["expenses"],
  members: [{ id: "u2", display_name: "Ana", role: "admin" }],
};

function render(input: { id?: string; searchParams?: Record<string, string> } = {}) {
  return CategoryPage({
    params: Promise.resolve({ id: input.id ?? "c1" }),
    searchParams: Promise.resolve(input.searchParams ?? {}),
  });
}

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "super_admin" },
  });
  loadCategoryMock.mockReset();
  loadMemberChoicesMock.mockReset();
  loadMemberChoicesMock.mockResolvedValue({
    ok: true,
    members: [
      { id: "u2", displayName: "Ana" },
      { id: "u3", displayName: "Luis" },
    ],
    total: 2,
  });
  loadModuleChoicesMock.mockReset();
  loadModuleChoicesMock.mockResolvedValue({
    ok: true,
    modules: [
      { key: "expenses", name: "Expenses" },
      { key: "balances", name: "Balances" },
    ],
  });
  notFoundMock.mockClear();
});

describe("CategoryPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("shows the breadcrumb, name, slug, members and the edit controls", async () => {
    loadCategoryMock.mockResolvedValue({ ok: true, category: CATEGORY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('href="/panel/categories"');
    expect(html).toContain("<h1");
    expect(html).toContain("Familia");
    expect(html).toContain("familia");
    expect(html).toContain("Ana");
    expect(html).toContain("Rename category");
    expect(html).toContain("Add member");
    expect(html).toContain("Assign module");
    expect(html).toContain("Danger zone");
    expect(loadCategoryMock).toHaveBeenCalledWith("c1");
  });

  it("shows assigned and available modules by their catalogue name", async () => {
    loadCategoryMock.mockResolvedValue({ ok: true, category: CATEGORY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Expenses");
    expect(html).toContain("Balances");
    expect(html).toContain("expenses");
    expect(html).toContain("balances");
  });

  it("passes the member search to the picker and keeps it visible", async () => {
    loadCategoryMock.mockResolvedValue({ ok: true, category: CATEGORY });

    const html = renderToStaticMarkup(await render({ searchParams: { memberQ: "ana" } }));

    expect(loadMemberChoicesMock).toHaveBeenCalledWith({ q: "ana" });
    expect(html).toContain('value="ana"');
  });

  it("disables deletion while the category still has modules", async () => {
    loadCategoryMock.mockResolvedValue({ ok: true, category: CATEGORY });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Remove the category modules before deleting the category.");
    expect(html).toContain("disabled");
  });

  it("offers deletion when no module is assigned", async () => {
    loadCategoryMock.mockResolvedValue({
      ok: true,
      category: { ...CATEGORY, modules: [], members: [] },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("Delete category");
    expect(html).not.toContain("Remove the category modules before deleting the category.");
  });

  it("renders notFound for a missing category", async () => {
    loadCategoryMock.mockResolvedValue({ ok: false, code: "not_found" });

    await expect(render({ id: "missing" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("shows the load error with the request id and a retry link", async () => {
    loadCategoryMock.mockResolvedValue({ ok: false, code: "internal", requestId: "req-500" });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load this category.");
    expect(html).toContain("req-500");
    expect(html).toContain('href="/panel/categories/c1"');
  });

  it("renders the generic 403 without loading the category", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("You do not have access to this page.");
    expect(loadCategoryMock).not.toHaveBeenCalled();
  });

  it("shows the request id and a retry link when a picker read fails", async () => {
    loadCategoryMock.mockResolvedValue({ ok: true, category: CATEGORY });
    loadMemberChoicesMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-members",
    });
    loadModuleChoicesMock.mockResolvedValue({
      ok: false,
      code: "internal",
      requestId: "req-modules",
    });

    const html = renderToStaticMarkup(await render());

    expect(html).toContain("load the members available to add.");
    expect(html).toContain("load the module catalogue.");
    expect(html).toContain("req-members");
    expect(html).toContain("req-modules");
    expect(html).toContain("Try again");
  });
});
