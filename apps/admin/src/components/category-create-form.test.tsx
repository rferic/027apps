import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CategoryCreateForm, categoryCreatedHref } from "./category-create-form";

describe("CategoryCreateForm", () => {
  it("renders the fields on a page, not inside a creation dialog", () => {
    const html = renderToStaticMarkup(<CategoryCreateForm messages={{}} />);

    expect(html).toContain("<form");
    // The form is page content, so it needs a surface of its own on wide screens.
    expect(html).toMatch(/<form[^>]*rounded-card[^>]*bg-surface/);
    expect(html).toContain("category-name");
    expect(html).toContain("category-slug");
    expect(html).toContain("Cancel");
    expect(html).toContain('href="/categories"');
    expect(html).not.toContain("<dialog");
  });

  it("starts empty: no error or secret from a previous creation", () => {
    const html = renderToStaticMarkup(<CategoryCreateForm messages={{}} />);

    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Create category");
  });
});

describe("categoryCreatedHref", () => {
  it("lands on the new detail so members and modules can be added", () => {
    expect(categoryCreatedHref("c1")).toBe("/categories/c1");
  });

  it("falls back to the list when the API returned no id", () => {
    expect(categoryCreatedHref(undefined)).toBe("/categories");
  });
});
