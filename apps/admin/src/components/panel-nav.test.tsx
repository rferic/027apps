import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = { current: "/panel/members" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

import { PanelNav } from "./panel-nav";

const ALL_HREFS = [
  "/panel",
  "/panel/members",
  "/panel/categories",
  "/panel/invitations",
  "/panel/modules",
  "/panel/keys",
  "/panel/settings/instance",
  "/panel/settings/localization",
  "/panel/settings/security",
  "/panel/settings/notifications",
  "/panel/settings/rate-limits",
  "/panel/docs/api",
  "/help/firebase",
];

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1] ?? "");
}

function currentHrefs(html: string): string[] {
  return [...html.matchAll(/<a [^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => tag.includes('aria-current="page"'))
    .map((tag) => tag.match(/href="([^"]+)"/)?.[1] ?? "");
}

beforeEach(() => {
  pathname.current = "/panel/members";
});

describe("PanelNav", () => {
  it("renders the five group headings in order as captions, not as rows", () => {
    const html = renderToStaticMarkup(<PanelNav role="super_admin" messages={{}} />);

    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]);
    expect(headings).toEqual(["Home", "Users", "Platform", "Settings", "Documentation"]);
  });

  it("renders every group destination in order with an icon", () => {
    const html = renderToStaticMarkup(<PanelNav role="super_admin" messages={{}} />);

    expect(hrefs(html)).toEqual(ALL_HREFS);
    expect(html).not.toContain('href="#"');
    // One glyph per destination, including the external guide.
    expect((html.match(/<svg /g) ?? []).length).toBe(ALL_HREFS.length);
    expect(html).toContain(">Dashboard</span>");
    expect(html).toContain(">Members</span>");
  });

  it("drops the Settings parent node, its expansion state and the indented children", () => {
    pathname.current = "/panel/settings/instance";
    const html = renderToStaticMarkup(<PanelNav role="super_admin" messages={{}} />);

    expect(html).not.toContain('href="/panel/settings"');
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("pl-6");
    for (const section of ["instance", "localization", "security", "notifications", "rate-limits"]) {
      expect(html).toContain(`href="/panel/settings/${section}"`);
    }
  });

  it("marks a single active destination with aria-current and the accent bar", () => {
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    expect(currentHrefs(html)).toEqual(["/panel/members"]);
    expect(html).toContain("border-accent bg-primary/10 font-semibold text-foreground");
    expect(html).toContain("min-h-11");
  });

  it("matches nested routes by prefix", () => {
    pathname.current = "/panel/members/u-1";
    const nested = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    expect(currentHrefs(nested)).toEqual(["/panel/members"]);

    pathname.current = "/panel";
    const home = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    expect(currentHrefs(home)).toEqual(["/panel"]);
  });

  it("does not mark /panel/members when a sibling route merely shares its prefix", () => {
    pathname.current = "/members-archive";
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    expect(currentHrefs(html)).toEqual([]);
  });

  it("marks the active settings section on its own", () => {
    pathname.current = "/panel/settings/security";
    const html = renderToStaticMarkup(<PanelNav role="super_admin" messages={{}} />);

    expect(currentHrefs(html)).toEqual(["/panel/settings/security"]);
  });

  it("marks the first visible settings section while /panel/settings redirects", () => {
    pathname.current = "/panel/settings";
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);

    expect(currentHrefs(html)).toEqual(["/panel/settings/instance"]);
  });

  it("hides API keys from an admin and shows them to a super_admin", () => {
    const admin = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    const superAdmin = renderToStaticMarkup(<PanelNav role="super_admin" messages={{}} />);

    expect(admin).not.toContain('href="/panel/keys"');
    expect(admin).not.toContain(">API keys</span>");
    expect(admin).toContain('href="/panel/modules"');
    expect(superAdmin).toContain('href="/panel/keys"');
  });

  it("hides security from an admin, both in the sidebar and the drawer", () => {
    pathname.current = "/panel/settings/instance";
    const sidebar = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    const drawer = renderToStaticMarkup(<PanelNav role="admin" messages={{}} variant="drawer" />);

    for (const html of [sidebar, drawer]) {
      expect(html).toContain('href="/panel/settings/instance"');
      expect(html).not.toContain('href="/panel/settings/security"');
      expect(html).not.toContain(">Security</span>");
      expect((html.match(/href="\/panel\/settings\/[^"]+"/g) ?? []).length).toBe(4);
    }
  });

  it("renders the Firebase guide as an external link without aria-current", () => {
    pathname.current = "/help/firebase";
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    const external = html.match(/<a [^>]*href="\/help\/firebase"[^>]*>/)?.[0] ?? "";

    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
    expect(external).toContain('aria-label="Firebase guide (Opens in a new tab)"');
    expect(external).not.toContain("aria-current");
    expect(external).toContain("border-transparent text-muted-foreground hover:bg-muted hover:text-foreground");
    expect(currentHrefs(html)).toEqual([]);
  });

  it("keeps aria-current on internal destinations only", () => {
    pathname.current = "/panel/docs/api";
    const html = renderToStaticMarkup(<PanelNav role="admin" messages={{}} />);
    const external = html.match(/<a [^>]*href="\/help\/firebase"[^>]*>/)?.[0] ?? "";

    expect(currentHrefs(html)).toEqual(["/panel/docs/api"]);
    expect(external).not.toContain("aria-current");
  });

  it("gives drawer rows more height and separates groups without changing labels", () => {
    pathname.current = "/panel/settings/instance";
    const sidebar = renderToStaticMarkup(<PanelNav role="admin" messages={{}} variant="sidebar" />);
    const drawer = renderToStaticMarkup(<PanelNav role="admin" messages={{}} variant="drawer" />);

    expect(sidebar).not.toContain("min-h-12");
    expect(drawer).toContain("min-h-12");
    expect((drawer.match(/border-t border-border pt-5/g) ?? []).length).toBe(4);
    for (const label of [
      "Home",
      "Users",
      "Platform",
      "Settings",
      "Documentation",
      "Dashboard",
      "API",
    ]) {
      expect(drawer).toContain(label);
    }
    expect(drawer).toContain('href="/panel/settings/instance"');
    expect(drawer).toContain('href="/help/firebase"');
  });

  it("translates group labels, destinations, sections and the navigation name", () => {
    pathname.current = "/panel/settings/instance";
    const html = renderToStaticMarkup(
      <PanelNav
        role="admin"
        messages={{
          Members: "Miembros",
          Settings: "Ajustes",
          Instance: "Instancia",
          Documentation: "Documentación",
          API: "API",
          "Firebase guide": "Guía de Firebase",
          "Opens in a new tab": "Se abre en una pestaña nueva",
          "Main navigation": "Navegación principal",
        }}
      />,
    );

    expect(html).toContain(">Miembros</span>");
    expect(html).toContain(">Ajustes</h2>");
    expect(html).toContain(">Instancia</span>");
    expect(html).toContain(">Documentación</h2>");
    expect(html).toContain(">API</span>");
    expect(html).toContain(">Guía de Firebase</span>");
    expect(html).toContain(
      'aria-label="Guía de Firebase (Se abre en una pestaña nueva)"',
    );
    expect(html).toContain('aria-label="Navegación principal"');
  });
});
