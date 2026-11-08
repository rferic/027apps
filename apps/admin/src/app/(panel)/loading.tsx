/** Route-level dashboard skeleton: the header, four KPIs and the module cards. */
export default function DashboardLoading() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="h-5 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((kpi) => (
          <div key={kpi} className="rounded-card border border-border bg-surface p-3">
            <div className="h-3 w-24 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-6 w-12 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1].map((card) => (
            <div
              key={card}
              className="flex min-h-11 items-center justify-between rounded-card border border-border bg-surface p-3"
            >
              <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
