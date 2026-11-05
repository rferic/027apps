import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("applies each variant with its translucent background and text color", () => {
    const cases = [
      ["success", "bg-success-subtle", "text-success"],
      ["destructive", "bg-destructive/10", "text-destructive"],
      ["neutral", "bg-muted", "text-muted-foreground"],
    ] as const;
    for (const [variant, background, color] of cases) {
      const html = renderToStaticMarkup(<Badge variant={variant}>Estado</Badge>);
      expect(html, `variant ${variant}`).toContain(background);
      expect(html, `variant ${variant}`).toContain(color);
    }
  });

  it("has pill shape", () => {
    const html = renderToStaticMarkup(<Badge>Activo</Badge>);
    expect(html).toContain("rounded-full");
  });

  it("forwards extra classes and renders its content", () => {
    const html = renderToStaticMarkup(<Badge className="uppercase">OK</Badge>);
    expect(html).toContain("uppercase");
    expect(html).toContain(">OK</span>");
  });
});
