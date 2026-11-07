import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { PanelMobileMenu } from "./panel-mobile-menu";

/**
 * `renderToStaticMarkup` renders the closed drawer and its trigger, but it
 * cannot run `showModal()`/`close()`: there is no DOM or user interaction in the
 * node test environment. The static contract (trigger label, native `<dialog>`,
 * header, nav and backdrop token) is asserted here; open/close/backdrop-click/
 * Escape behave through the browser's native `<dialog>` and are covered by the
 * dev-server check, not by these unit tests.
 */
describe("PanelMobileMenu", () => {
  it("renders a mobile-only trigger with an accessible name", () => {
    const html = renderToStaticMarkup(<PanelMobileMenu role="admin" messages={{}} />);

    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain("lg:hidden");
    expect(html).toContain("min-h-11 min-w-11");
  });

  it("renders a native dialog with the Menu title, a close button and the navigation", () => {
    const html = renderToStaticMarkup(<PanelMobileMenu role="admin" messages={{}} />);

    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="Menu"');
    expect(html).toContain(">Menu</h2>");
    expect(html).toContain('aria-label="Close menu"');
    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('href="/members"');
  });

  it("uses the sliding panel layout and the backdrop token", () => {
    const html = renderToStaticMarkup(<PanelMobileMenu role="admin" messages={{}} />);

    expect(html).toContain("fixed inset-y-0 left-0");
    expect(html).toContain("w-72");
    expect(html).toContain("max-w-[85vw]");
    expect(html).toContain("bg-surface");
    expect(html).toContain("backdrop:bg-foreground/40");
  });

  it("translates the trigger, the title and the close button", () => {
    const html = renderToStaticMarkup(
      <PanelMobileMenu
        role="admin"
        messages={{
          Menu: "Menú",
          "Open menu": "Abrir el menú",
          "Close menu": "Cerrar el menú",
        }}
      />,
    );

    expect(html).toContain('aria-label="Abrir el menú"');
    expect(html).toContain('aria-label="Cerrar el menú"');
    expect(html).toContain(">Menú</h2>");
  });
});
