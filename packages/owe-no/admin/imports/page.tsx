/** OweNo imports: the Splitwise export, previewed before committing. */
export default async function OweNoImports() {
  return (
    <section aria-labelledby="owe-no-imports" className="flex flex-col gap-3">
      <h1 id="owe-no-imports" className="text-base font-bold">
        Imports
      </h1>
      <p className="text-xs text-muted-foreground">
        The Splitwise importer runs from the app. This page records what was
        imported and lets an admin review a pending batch.
      </p>
    </section>
  );
}
