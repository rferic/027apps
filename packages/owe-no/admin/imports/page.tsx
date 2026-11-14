import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import { listImports } from "@027apps/owe-no/domain/importer.js";

/**
 * Import history: one row per committed file. Importing happens in the app, on
 * the group the creator picks; the panel only reviews what landed and why.
 */
export default async function OweNoImports({ context }: { context: ModulePageContext }) {
  const batches = await listImports({ db: context.db });

  return (
    <section aria-labelledby="owe-no-imports" className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h1 id="owe-no-imports" className="text-base font-bold">
          Imports
        </h1>
        <p className="text-xs text-muted-foreground">
          Splitwise batches committed from the app. The panel reviews them; it never imports.
        </p>
      </header>

      {batches.length === 0 ? (
        <p className="text-xs text-muted-foreground">No imports yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-3 text-xs"
            >
              <span className="font-semibold">{batch.group_name}</span>
              <span className="text-muted-foreground">
                {batch.created_count} of {batch.row_count} rows ·{" "}
                {new Date(batch.created_at).toISOString().slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
