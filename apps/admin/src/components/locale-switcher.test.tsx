import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { LocaleSwitcher } from "./locale-switcher";

describe("LocaleSwitcher", () => {
  it("renders every native language name with the active locale selected", () => {
    const html = renderToStaticMarkup(<LocaleSwitcher locale="es" label="Idioma" />);

    for (const label of [
      "English",
      "Español",
      "Català",
      "Italiano",
      "Français",
      "Deutsch",
      "Português",
      "Galego",
      "Euskara",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('<option value="es" selected="">Español</option>');
    expect(html).toContain('aria-label="Idioma"');
  });
});
