import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = { current: "/members" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

import { PanelNav } from "./panel-nav";

const HREFS = ["/", "/members", "/categories", "/invitations", "/modules", "/keys", "/settings", "/docs/api"];

beforeEach(() => {
  pathname.current = "/members";
});

describe("PanelNav", () => {
  it("renders the four mental-model groups", () => {
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    for (const group of ["Home", "People", "Platform", "System"]) {
      expect(html).toContain(group);
    }
  });

  it("renders the eight destinations as real links", () => {
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    for (const href of HREFS) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="#"');
  });

  it("marks the matching destination with aria-current", () => {
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/members"/);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);
  });

  it("matches nested routes by prefix but keeps / exact", () => {
    pathname.current = "/members/u-1";
    const nested = renderToStaticMarkup(<PanelNav messages={{}} />);
    expect(nested).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/members"/);
    expect(nested).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);

    pathname.current = "/";
    const home = renderToStaticMarkup(<PanelNav messages={{}} />);
    expect(home).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);
  });

  it("does not mark /members when a sibling route merely shares its prefix", () => {
    pathname.current = "/members-archive";
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    expect(html).not.toContain('aria-current="page"');
  });

  it("translates labels and the navigation name", () => {
    const html = renderToStaticMarkup(
      <PanelNav messages={{ Members: "Miembros", "Main navigation": "Navegación principal" }} />,
    );

    expect(html).toContain("Miembros");
    expect(html).toContain('aria-label="Navegación principal"');
  });
});
