/**
 * OweNo overview. The panel host gates role and module state; this component
 * only renders. It stays server-only: no module HTML or client bundle leaks.
 */
export default async function OweNoOverview() {
  return (
    <section aria-labelledby="owe-no-overview" className="flex flex-col gap-3">
      <h1 id="owe-no-overview" className="text-base font-bold">
        OweNo
      </h1>
      <p className="text-xs text-muted-foreground">
        Shared expenses and settlements. Groups, balances and the Splitwise
        importer live in their own pages.
      </p>
    </section>
  );
}
