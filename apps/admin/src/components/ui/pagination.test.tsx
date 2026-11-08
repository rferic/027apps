import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

function render(html: Parameters<typeof Pagination>[0]): string {
  return renderToStaticMarkup(<Pagination {...html} />);
}

describe("Pagination", () => {
  it("stays visible and disabled on a single page", () => {
    const html = render({ page: 1, pages: 1, hrefFor: () => "/items", messages: {} });

    expect(html).toContain("Page 1 of 1");
    expect(html).toContain("aria-disabled=\"true\"");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).not.toContain("<a ");
  });

  it("links to the previous page in the middle of a list", () => {
    const html = render({ page: 2, pages: 3, hrefFor: (page) => `/items?page=${page}`, messages: {} });

    expect(html).toContain('href="/items?page=1"');
    expect(html).toContain('href="/items?page=3"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain("Page 2 of 3");
  });

  it("disables the next link on the last page and the previous one on the first", () => {
    const last = render({ page: 3, pages: 3, hrefFor: (page) => `/items?page=${page}`, messages: {} });
    expect(last).toContain('href="/items?page=2"');
    expect(last).not.toContain('href="/items?page=4"');

    const first = render({ page: 1, pages: 3, hrefFor: (page) => `/items?page=${page}`, messages: {} });
    expect(first).not.toContain('href="/items?page=0"');
    expect(first).toContain('href="/items?page=2"');
  });

  it("clamps an out-of-range page instead of rendering empty links", () => {
    const html = render({ page: 9, pages: 3, hrefFor: (page) => `/items?page=${page}`, messages: {} });

    expect(html).toContain("Page 3 of 3");
    expect(html).not.toContain('href="/items?page=10"');
  });
});
