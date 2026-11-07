import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSwitcher } from "./theme-switcher";

describe("ThemeSwitcher", () => {
  it("renders System, Light and Dark with System selected by default", () => {
    const html = renderToStaticMarkup(<ThemeSwitcher messages={{}} />);

    expect(html).toContain('<option value="system" selected="">System</option>');
    expect(html).toContain('<option value="light">Light</option>');
    expect(html).toContain('<option value="dark">Dark</option>');
    expect(html).toContain('aria-label="Theme"');
  });

  it("translates the labels", () => {
    const html = renderToStaticMarkup(
      <ThemeSwitcher messages={{ System: "Sistema", Light: "Claro", Dark: "Oscuro", Theme: "Tema" }} />,
    );

    expect(html).toContain('aria-label="Tema"');
    expect(html).toContain(">Sistema</option>");
    expect(html).toContain(">Claro</option>");
    expect(html).toContain(">Oscuro</option>");
  });
});
