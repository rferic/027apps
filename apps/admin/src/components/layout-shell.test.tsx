import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LayoutShell } from "./layout-shell";

const nav = [
  { label: "Dashboard", active: true },
  { label: "Miembros" },
  { label: "Gastos" },
];

describe("LayoutShell", () => {
  it("composes sidebar and topbar over the base background", () => {
    const html = renderToStaticMarkup(
      <LayoutShell title="Dashboard Familia" nav={nav}>
        contenido
      </LayoutShell>,
    );
    expect(html).toContain('aria-label="Principal"');
    expect(html).toContain("Dashboard Familia");
    expect(html).toContain("bg-background");
    expect(html).toContain("bg-muted");
  });

  it("adapts to mobile: stacked grid and horizontal nav below lg", () => {
    const html = renderToStaticMarkup(<LayoutShell title="T" nav={nav}>x</LayoutShell>);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("lg:grid-cols-[200px_1fr]");
    expect(html).toContain("lg:flex-col");
    expect(html).toContain("overflow-x-auto");
  });

  it("marks the active nav item with the solid primary token and aria-current", () => {
    const html = renderToStaticMarkup(<LayoutShell title="T" nav={nav}>x</LayoutShell>);
    expect(html).toContain(">Dashboard</a>");
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-primary-foreground");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain('aria-current="page"');
  });

  it("renders the content and the topbar actions", () => {
    const html = renderToStaticMarkup(
      <LayoutShell title="T" nav={nav} actions={<input placeholder="Buscar..." />}>
        <button>Acción</button>
      </LayoutShell>,
    );
    expect(html).toContain('placeholder="Buscar..."');
    expect(html).toContain(">Acción</button>");
  });
});
