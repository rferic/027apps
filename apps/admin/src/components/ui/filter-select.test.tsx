import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterSelect, filterHref } from "./filter-select";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

describe("filterHref", () => {
  it("sets the changed filter on the base path", () => {
    expect(filterHref({ basePath: "/keys", params: {}, name: "state", value: "active" })).toBe(
      "/keys?state=active",
    );
  });

  it("keeps the other filters and resets the page", () => {
    const href = filterHref({
      basePath: "/members",
      params: { q: "ana", role: "admin", page: "3" },
      name: "state",
      value: "deactivated",
    });

    expect(href).toBe("/members?q=ana&role=admin&state=deactivated");
    expect(href).not.toContain("page");
  });

  it("replaces the value of the changed filter instead of duplicating it", () => {
    expect(
      filterHref({
        basePath: "/modules",
        params: { state: "active", public: "yes" },
        name: "state",
        value: "disabled",
      }),
    ).toBe("/modules?public=yes&state=disabled");
  });

  it("drops the key when the value is empty (all)", () => {
    expect(
      filterHref({
        basePath: "/invitations",
        params: { status: "pending" },
        name: "status",
        value: "",
      }),
    ).toBe("/invitations");
  });

  it("never emits a page key even when the filter params carry one", () => {
    const href = filterHref({
      basePath: "/keys",
      params: { page: "2" },
      name: "state",
      value: "",
    });

    expect(href).toBe("/keys");
  });
});

describe("FilterSelect", () => {
  const options = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
  ];

  it("renders a named select with the current value and no submit button", () => {
    const html = renderToStaticMarkup(
      <FilterSelect
        name="state"
        label="Status"
        value="active"
        options={options}
        basePath="/keys"
        params={{}}
      />,
    );

    expect(html).toContain("<select");
    expect(html).toContain('name="state"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain("Status");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });
});
