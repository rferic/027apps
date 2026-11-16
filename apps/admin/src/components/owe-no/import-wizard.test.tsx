import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OweImportWizard } from "./import-wizard";

/**
 * The owner could not tell that the import screen was where a file goes, so the
 * first step is now a drop zone with its own button. These assertions pin the
 * affordance: the drop area, the pick button, the size limit and the fact that
 * the analyze button waits for a file.
 */
describe("import wizard", () => {
  it("opens on a drop zone that says what to do", () => {
    const html = renderToStaticMarkup(<OweImportWizard groupId="g1" locale="es" />);
    expect(html).toContain("Arrastra el CSV aquí");
    expect(html).toContain("Elegir archivo");
    expect(html).toContain("Formato .csv, hasta 2 MB.");
    expect(html).toContain("Exportar como CSV");
  });

  it("keeps the analyze button disabled until a file is chosen", () => {
    const html = renderToStaticMarkup(<OweImportWizard groupId="g1" locale="es" />);
    expect(html).toMatch(/disabled[^>]*>\s*Analizar archivo/);
    expect(html).toContain("Elige un archivo para continuar.");
  });

  it("speaks English when the panel does", () => {
    const html = renderToStaticMarkup(<OweImportWizard groupId="g1" locale="en" />);
    expect(html).toContain("Drop the CSV here");
    expect(html).toContain("Choose file");
    expect(html).toContain("up to 2 MB");
  });
});
