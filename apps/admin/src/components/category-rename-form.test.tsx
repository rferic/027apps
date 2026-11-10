import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/categories/c1",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CategoryRenameForm } from "./category-rename-form";

describe("CategoryRenameForm", () => {
  it("renders on a surface of its own so it does not float on wide screens", () => {
    const html = renderToStaticMarkup(
      <CategoryRenameForm id="c1" name="Familia" messages={{}} />,
    );

    expect(html).toMatch(/<form[^>]*rounded-card[^>]*bg-surface/);
    expect(html).toContain('value="Familia"');
  });
});
