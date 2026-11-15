/** Route-level skeleton so navigating to `/invitations` responds immediately. */
export default function InvitationsLoading() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-11 w-full max-w-sm animate-pulse rounded-control bg-muted" />
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-4 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </section>
  );
}
