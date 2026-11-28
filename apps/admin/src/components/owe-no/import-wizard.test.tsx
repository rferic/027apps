import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IMPORT_COPY, MappingStep, OweImportWizard } from "./import-wizard";

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

  it("maps a name with a native select that includes the group's own members", () => {
    // The owner asked why their user was missing from the mapping selector:
    // their account is already a member, so it must be listed there instead of
    // being filtered out.
    const html = renderToStaticMarkup(
      <MappingStep
        copy={IMPORT_COPY.es}
        preview={{
          movements: 1,
          payments: 0,
          derived: 0,
          skipped: 0,
          duplicates: 0,
          currencies: ["EUR"],
          errors: [],
          unresolved: ["Eric"],
          sample: [],
        }}
        identities={[
          { id: "m1", display_name: "Eric", kind: "member" },
          { id: "u9", display_name: "Pablo", kind: "account", email: "pablo@example.com" },
        ]}
        choices={{}}
        onChoice={() => {}}
        ready={false}
        busy={false}
        wipe={false}
        onWipe={() => {}}
        onRun={() => {}}
      />,
    );
    expect(html).toContain("<select");
    expect(html).toContain("Ya en el grupo");
    expect(html).toContain("Cuentas");
    expect(html).toContain("Eric");
    expect(html).toContain("Pablo");
    expect(html).toContain("pablo@example.com");
    expect(html).toContain("Tu cuenta no aparece aquí si ya eres miembro");
  });
});
