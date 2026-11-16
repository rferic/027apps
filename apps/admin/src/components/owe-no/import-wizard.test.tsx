import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OweImportWizard } from "./import-wizard";

/**
 * The owner could not tell that the import screen was where a file goes, so the
 * flow starts behind a button that opens a modal: nothing is imported until the
 * last step and closing cancels. The dialog itself mounts on the client, so the
 * static render shows the launcher.
 */
describe("import wizard", () => {
  it("starts with a button that says what it does", () => {
    const html = renderToStaticMarkup(<OweImportWizard groupId="g1" locale="es" />);
    expect(html).toContain("Importar un CSV");
    expect(html).toContain("Sube el CSV del grupo");
    expect(html).not.toContain("<dialog");
  });

  it("speaks English when the panel does", () => {
    const html = renderToStaticMarkup(<OweImportWizard groupId="g1" locale="en" />);
    expect(html).toContain("Import a CSV");
    expect(html).toContain("Upload the group&#x27;s CSV");
  });
});
