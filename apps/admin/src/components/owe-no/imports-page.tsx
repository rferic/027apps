import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import OweNoImports from "@027apps/owe-no/admin/imports/page";
import { OweImportWizard } from "@/components/owe-no/import-wizard";

/** Wires the module's import page to the panel's client wizard. */
export default async function OweNoImportsPage({ context }: { context: ModulePageContext }) {
  return <OweNoImports context={context} ImportWizard={OweImportWizard} />;
}
