import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("uses the primary variant by default with solid tokens", () => {
    const html = renderToStaticMarkup(<Button>Guardar</Button>);
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-primary-foreground");
  });

  it("does not mix a border color with border-transparent in secondary and destructive", () => {
    const variants = ["secondary", "destructive"] as const;
    for (const variant of variants) {
      const html = renderToStaticMarkup(<Button variant={variant}>Acción</Button>);
      expect(html, `variant ${variant}`).not.toContain("border-transparent");
    }
  });

  it("applies each variant with its tokens", () => {
    const cases = [
      ["secondary", "bg-muted"],
      ["ghost", "text-accent"],
      ["destructive", "border-destructive"],
    ] as const;
    for (const [variant, token] of cases) {
      const html = renderToStaticMarkup(<Button variant={variant}>Acción</Button>);
      expect(html, `variant ${variant}`).toContain(token);
    }
  });

  it("forwards native attributes and extra classes", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" data-testid="guardar" className="w-full">
        Guardar
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('data-testid="guardar"');
    expect(html).toContain("w-full");
  });

  it("renders its content as the button child", () => {
    const html = renderToStaticMarkup(<Button>Añadir gasto</Button>);
    expect(html).toContain(">Añadir gasto</button>");
  });
});
