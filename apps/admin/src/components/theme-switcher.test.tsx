import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSwitcher } from "./theme-switcher";

describe("ThemeSwitcher", () => {
  it("renders Automatic, Light and Dark with Automatic selected by default", () => {
    const html = renderToStaticMarkup(<ThemeSwitcher messages={{}} />);

    expect(html).toContain('<option value="system" selected="">Automatic</option>');
    expect(html).toContain('<option value="light">Light</option>');
    expect(html).toContain('<option value="dark">Dark</option>');
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain('title="Follows your device setting."');
  });

  it("translates the labels", () => {
    const html = renderToStaticMarkup(
      <ThemeSwitcher
        messages={{
          Automatic: "Automático",
          Light: "Claro",
          Dark: "Oscuro",
          Theme: "Tema",
          "Follows your device setting.": "Sigue la configuración de tu dispositivo.",
        }}
      />,
    );

    expect(html).toContain('aria-label="Tema"');
    expect(html).toContain(">Automático</option>");
    expect(html).toContain(">Claro</option>");
    expect(html).toContain(">Oscuro</option>");
  });
});
