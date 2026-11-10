import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CategoryModules } from "./category-modules";

describe("CategoryModules", () => {
  it("renders on a surface of its own so it does not float on wide screens", () => {
    const html = renderToStaticMarkup(
      <CategoryModules
        categoryId="c1"
        assigned={[]}
        available={[]}
        retryHref="/categories/c1"
        messages={{}}
      />,
    );

    expect(html).toMatch(/<section[^>]*rounded-card[^>]*bg-surface/);
  });
});
