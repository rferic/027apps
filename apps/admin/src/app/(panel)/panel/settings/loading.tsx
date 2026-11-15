/** Route-level skeleton so navigating to `/settings` responds immediately. */
export default function SettingsLoading() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-80 animate-pulse rounded-md bg-muted" />
      </div>
      {[0, 1, 2].map((section) => (
        <div key={section} className="rounded-card border border-border bg-surface p-4">
          <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1, 2].map((field) => (
              <div key={field} className="h-11 animate-pulse rounded-control bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
