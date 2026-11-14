import type { ModulePageContext } from "@027apps/core/modules/pages.js";

/**
 * Import history. The importer itself runs from the app; this page will list
 * the batches once the import log lands.
 */
export default async function OweNoImports({ context }: { context: ModulePageContext }) {
  return (
    <section aria-labelledby="owe-no-imports" className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h1 id="owe-no-imports" className="text-base font-bold">
          Imports
        </h1>
        <p className="text-xs text-muted-foreground">
          The Splitwise importer runs from the app, on the group its creator picks. This page
          will list the batches, their counts and why a file was rejected.
        </p>
      </header>
      <p className="text-xs text-muted-foreground">
        Module: <code className="font-mono">{context.moduleKey}</code>
      </p>
    </section>
  );
}
