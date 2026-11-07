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
  it("renders four group headings as captions, not as rows", () => {
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    for (const group of ["Home", "People", "Platform", "System"]) {
      expect(html).toContain(`<h2 class="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">${group}</h2>`);
    }
    expect((html.match(/<h2 /g) ?? []).length).toBe(4);
  });

  it("renders the eight destinations as real links with an icon", () => {
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    for (const href of HREFS) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="#"');
    // One glyph per destination, plus the label next to it.
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).toContain(">Dashboard</span>");
    expect(html).toContain(">Members</span>");
  });

  it("marks a single active destination with aria-current and the accent bar", () => {
    const html = renderToStaticMarkup(<PanelNav messages={{}} />);

    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/members"/);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);
    expect(html).toContain("border-accent bg-primary/10 font-semibold text-foreground");
    expect(html).toContain("min-h-11");
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

  it("gives drawer rows more height and separates groups without changing labels", () => {
    const sidebar = renderToStaticMarkup(<PanelNav messages={{}} variant="sidebar" />);
    const drawer = renderToStaticMarkup(<PanelNav messages={{}} variant="drawer" />);

    expect(sidebar).not.toContain("min-h-12");
    expect(drawer).toContain("min-h-12");
    expect(drawer).toContain("border-t border-border pt-5");
    for (const label of ["Home", "People", "Platform", "System", "Dashboard", "API docs"]) {
      expect(drawer).toContain(label);
    }
  });

  it("translates labels and the navigation name", () => {
    const html = renderToStaticMarkup(
      <PanelNav messages={{ Members: "Miembros", "Main navigation": "Navegación principal" }} />,
    );

    expect(html).toContain("Miembros");
    expect(html).toContain('aria-label="Navegación principal"');
  });
});
