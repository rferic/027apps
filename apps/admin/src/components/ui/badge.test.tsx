import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("aplica cada variante con su fondo translúcido y color de texto", () => {
    const cases = [
      ["success", "bg-success-subtle", "text-success"],
      ["destructive", "bg-destructive/10", "text-destructive"],
      ["neutral", "bg-muted", "text-muted-foreground"],
    ] as const;
    for (const [variant, background, color] of cases) {
      const html = renderToStaticMarkup(<Badge variant={variant}>Estado</Badge>);
      expect(html, `variante ${variant}`).toContain(background);
      expect(html, `variante ${variant}`).toContain(color);
    }
  });

  it("tiene forma de píldora", () => {
    const html = renderToStaticMarkup(<Badge>Activo</Badge>);
    expect(html).toContain("rounded-full");
  });

  it("propaga clase extra y renderiza el contenido", () => {
    const html = renderToStaticMarkup(<Badge className="uppercase">OK</Badge>);
    expect(html).toContain("uppercase");
    expect(html).toContain(">OK</span>");
  });
});