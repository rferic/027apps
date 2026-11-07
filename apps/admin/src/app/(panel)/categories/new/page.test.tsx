import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePanelMock = vi.fn();

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

import NewCategoryPage, { instant } from "./page";

beforeEach(() => {
  requirePanelMock.mockReset();
  requirePanelMock.mockResolvedValue({
    user: { id: "u1", email: "admin@example.com", displayName: "Admin", role: "admin" },
  });
});

describe("NewCategoryPage", () => {
  it("opts the segment out of the static shell", () => {
    expect(instant).toBe(false);
  });

  it("renders the breadcrumb, title, back link and the form on the page", async () => {
    const html = renderToStaticMarkup(await NewCategoryPage());

    expect(html).toContain("Breadcrumb");
    expect(html).toContain("New category");
    expect(html).toContain("Back");
    expect(html).toContain('href="/categories"');
    expect(html).toContain("category-name");
    expect(html).toContain("category-slug");
    expect(html).not.toContain("<dialog");
  });

  it("renders the generic 403 and no form when the role is denied", async () => {
    requirePanelMock.mockResolvedValue({
      denied: true,
      user: { id: "u9", email: "user@example.com", displayName: "User", role: "user" },
    });

    const html = renderToStaticMarkup(await NewCategoryPage());

    expect(html).toContain("You do not have access to this page.");
    expect(html).not.toContain("category-name");
  });

  it("asks for the admin role", async () => {
    await NewCategoryPage();

    expect(requirePanelMock).toHaveBeenCalledWith("admin");
  });
});
