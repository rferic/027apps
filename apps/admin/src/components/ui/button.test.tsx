import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("usa la variante primary por defecto con tokens sólidos", () => {
    const html = renderToStaticMarkup(<Button>Guardar</Button>);
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-primary-foreground");
  });

  it("aplica cada variante con sus tokens", () => {
    const cases = [
      ["secondary", "bg-muted"],
      ["ghost", "text-accent"],
      ["destructive", "border-destructive"],
    ] as const;
    for (const [variant, token] of cases) {
      const html = renderToStaticMarkup(<Button variant={variant}>Acción</Button>);
      expect(html, `variante ${variant}`).toContain(token);
    }
  });

  it("propaga atributos nativos y clase extra", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" data-testid="guardar" className="w-full">
        Guardar
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('data-testid="guardar"');
    expect(html).toContain("w-full");
  });

  it("renderiza el contenido como hijo del botón", () => {
    const html = renderToStaticMarkup(<Button>Añadir gasto</Button>);
    expect(html).toContain(">Añadir gasto</button>");
  });
});