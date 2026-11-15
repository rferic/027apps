/** Route-level skeleton so navigating to `/panel/invitations/{id}` responds immediately. */
export default function InvitationLoading() {
  return (
    <section aria-busy="true" className="flex flex-col gap-5">
      <div className="h-3 w-40 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-5 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1].map((row) => (
            <div key={row} className="h-4 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </section>
  );
}
