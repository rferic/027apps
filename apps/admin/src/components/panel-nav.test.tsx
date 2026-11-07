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
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    for (const group of ["Home", "People", "Platform", "System"]) {
      expect(html).toContain(`<h2 class="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">${group}</h2>`);
    }
    expect((html.match(/<h2 /g) ?? []).length).toBe(4);
  });

  it("renders the eight top-level destinations as real links with an icon", () => {
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    for (const href of HREFS) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).not.toContain('href="#"');
    // One glyph per top-level destination; children are indented text rows.
    expect((html.match(/<svg /g) ?? []).length).toBe(8);
    expect(html).toContain(">Dashboard</span>");
    expect(html).toContain(">Members</span>");
  });

  it("marks a single active destination with aria-current and the accent bar", () => {
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/members"/);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);
    expect(html).toContain("border-accent bg-primary/10 font-semibold text-foreground");
    expect(html).toContain("min-h-11");
  });

  it("matches nested routes by prefix but keeps / exact", () => {
    pathname.current = "/members/u-1";
    const nested = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    expect(nested).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/members"/);
    expect(nested).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);

    pathname.current = "/";
    const home = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    expect(home).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/"/);
  });

  it("does not mark /members when a sibling route merely shares its prefix", () => {
    pathname.current = "/members-archive";
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    expect(html).not.toContain('aria-current="page"');
  });

  it("keeps the settings tree collapsed outside /settings", () => {
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    expect(html).toMatch(/<a[^>]*aria-expanded="false"[^>]*href="\/settings"/);
    expect(html).not.toContain('href="/settings/instance"');
  });

  it("expands the settings tree and marks the active child on its own", () => {
    pathname.current = "/settings/security";
    const html = renderToStaticMarkup(<PanelNav role="super_admin" messages={{}} />);

    expect(html).toMatch(/<a[^>]*aria-expanded="true"[^>]*href="\/settings"/);
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/settings\/security"/);
    expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/settings"/);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    for (const href of [
      "/settings/instance",
      "/settings/localization",
      "/settings/security",
      "/settings/notifications",
      "/settings/rate-limits",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    // Children are indented and have no icon of their own.
    expect(html).toContain("pl-6");
  });

  it("hides security from an admin, both in the sidebar and the drawer", () => {
    pathname.current = "/settings/instance";
    const sidebar = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    const drawer = renderToStaticMarkup(<PanelNav role="admin" messages={{}} variant="drawer" />);

    for (const html of [sidebar, drawer]) {
      expect(html).toContain('href="/settings/instance"');
      expect(html).not.toContain('href="/settings/security"');
      expect(html).not.toContain(">Security</span>");
      expect((html.match(/href="\/settings\/[^"]+"/g) ?? []).length).toBe(4);
    }
  });

  it("gives drawer rows more height and separates groups without changing labels", () => {
    pathname.current = "/settings/instance";
    const sidebar = renderToStaticMarkup(<PanelNav role="admin" messages={{}} variant="sidebar" />);
    const drawer = renderToStaticMarkup(<PanelNav role="admin" messages={{}} variant="drawer" />);

    expect(sidebar).not.toContain("min-h-12");
    expect(drawer).toContain("min-h-12");
    expect(drawer).toContain("border-t border-border pt-5");
    for (const label of ["Home", "People", "Platform", "System", "Dashboard", "API docs"]) {
      expect(drawer).toContain(label);
    }
    expect(drawer).toContain('href="/settings/instance"');
  });

  it("translates labels, section children and the navigation name", () => {
    pathname.current = "/settings/instance";
    const html = renderToStaticMarkup(
      <PanelNav
        role="admin"
        messages={{
          Members: "Miembros",
          Settings: "Ajustes",
          Instance: "Instancia",
          "Main navigation": "Navegación principal",
        }}
      />,
    );

    expect(html).toContain("Miembros");
    expect(html).toContain("Ajustes");
    expect(html).toContain("Instancia");
    expect(html).toContain('aria-label="Navegación principal"');
  });
});
