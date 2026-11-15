/** Route-level skeleton so navigating to `/panel/keys/{id}/edit` responds immediately. */
export default function EditKeyLoading() {
  return (
    <section aria-busy="true" className="flex max-w-xl flex-col gap-4">
      <div className="h-3 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-20 animate-pulse rounded-card border border-border bg-surface" />
      <div className="h-11 animate-pulse rounded-control bg-muted" />
      <div className="h-11 animate-pulse rounded-control bg-muted" />
      <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />
    </section>
  );
}
