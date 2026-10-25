import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KpiCard } from "./kpi-card";

describe("KpiCard", () => {
  it("renderiza la etiqueta en uppercase muted sobre un fondo diferenciado", () => {
    const html = renderToStaticMarkup(<KpiCard label="Gasto Total" value="2.458,20 €" />);
    expect(html).toContain("uppercase");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("bg-background");
    expect(html).toContain("border-border");
  });

  it("muestra el valor en mono", () => {
    const html = renderToStaticMarkup(<KpiCard label="Balance" value="+120,50 €" />);
    expect(html).toContain("font-mono");
    expect(html).toContain("+120,50 €");
  });

  it("muestra el delta solo cuando se pasa y en color de acento", () => {
    const withDelta = renderToStaticMarkup(
      <KpiCard label="Miembros" value="14" delta="+1 esta semana" />,
    );
    expect(withDelta).toContain("+1 esta semana");
    expect(withDelta).toContain("text-accent");

    const withoutDelta = renderToStaticMarkup(<KpiCard label="Miembros" value="14" />);
    expect(withoutDelta).not.toContain(">+1 esta semana<");
  });

  it("aplica el tono del valor con tokens", () => {
    const html = renderToStaticMarkup(<KpiCard label="Pendiente" value="340,00 €" tone="destructive" />);
    expect(html).toContain("text-destructive");
  });

  it("propaga clase extra", () => {
    const html = renderToStaticMarkup(<KpiCard label="X" value="1" className="w-full" />);
    expect(html).toContain("w-full");
  });
});