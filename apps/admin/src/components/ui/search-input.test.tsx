import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS, SearchInput, searchHref, shouldSearch } from "./search-input";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

describe("searchHref", () => {
  it("sets the search on the base path", () => {
    expect(
      searchHref({ basePath: "/members", params: {}, name: "q", value: "ana" }),
    ).toBe("/members?q=ana");
  });

  it("keeps the other filters and resets the page", () => {
    const href = searchHref({
      basePath: "/members",
      params: { role: "admin", state: "deactivated", page: "3" },
      name: "q",
      value: "ana",
    });

    expect(href).toBe("/members?role=admin&state=deactivated&q=ana");
    expect(href).not.toContain("page");
  });

  it("normalises the search and drops the key when it is empty", () => {
    expect(searchHref({ basePath: "/categories", params: {}, name: "q", value: "  fam  " })).toBe(
      "/categories?q=fam",
    );
    expect(searchHref({ basePath: "/categories", params: { q: "fam" }, name: "q", value: "   " })).toBe(
      "/categories",
    );
  });
});

describe("shouldSearch", () => {
  it("is false while the text matches the URL", () => {
    expect(shouldSearch("ana", "ana")).toBe(false);
    expect(shouldSearch("  ana  ", "ana")).toBe(false);
    expect(shouldSearch("", "")).toBe(false);
    expect(shouldSearch("   ", "")).toBe(false);
  });

  it("is true only when the normalised text differs from the URL", () => {
    expect(shouldSearch("an", "ana")).toBe(true);
    expect(shouldSearch("ana", "")).toBe(true);
    expect(shouldSearch("", "ana")).toBe(true);
  });
});

describe("SearchInput", () => {
  it("debounces instead of offering a search button", () => {
    const html = renderToStaticMarkup(
      <SearchInput
        name="q"
        value="ana"
        basePath="/members"
        params={{}}
        label="Search by name or email"
        placeholder="Search"
        messages={{}}
      />,
    );

    expect(SEARCH_DEBOUNCE_MS).toBe(300);
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain(">Search<");
    expect(html).toContain('role="search"');
  });

  it("renders the current value as the controlled search field", () => {
    const html = renderToStaticMarkup(
      <SearchInput
        name="q"
        value="ana"
        basePath="/members"
        params={{}}
        label="Search by name or email"
        placeholder="Search"
        messages={{}}
      />,
    );

    expect(html).toContain('name="q"');
    expect(html).toContain('value="ana"');
    expect(html).toContain('placeholder="Search"');
    expect(html).toContain("Search by name or email");
    expect(html).toContain('aria-busy="false"');
  });

  it("offers a labelled clear button only while there is text", () => {
    const props = {
      name: "q",
      basePath: "/members",
      params: {},
      label: "Search by name or email",
      placeholder: "Search",
      messages: {},
    };

    const filled = renderToStaticMarkup(<SearchInput {...props} value="ana" />);
    expect(filled).toContain('type="button"');
    expect(filled).toContain('aria-label="Clear search"');

    const empty = renderToStaticMarkup(<SearchInput {...props} value="" />);
    expect(empty).not.toContain('aria-label="Clear search"');
  });
});
