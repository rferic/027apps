/** Route-level skeleton so navigating to `/modules/install` responds immediately. */
export default function InstallModuleLoading() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="h-3 w-32 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-1">
        <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-4 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </section>
  );
}
