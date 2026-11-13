import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CategoryMembers } from "./category-members";

describe("CategoryMembers", () => {
  it("renders on a surface of its own so it does not float on wide screens", () => {
    const html = renderToStaticMarkup(
      <CategoryMembers
        categoryId="c1"
        categoryName="Familia"
        members={[]}
        choices={[]}
        memberQuery=""
        truncated={false}
        retryHref="/panel/categories/c1"
        messages={{}}
      />,
    );

    expect(html).toMatch(/<section[^>]*rounded-card[^>]*bg-surface/);
  });
});
