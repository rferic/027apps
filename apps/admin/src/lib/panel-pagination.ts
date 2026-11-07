/** Page size used by every paginated list in the panel. */
export const PANEL_PAGE_SIZE = 20;

/** First value when a query key repeats (`?page=2&page=3`). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 1-based page from the query; anything invalid falls back to the first page. */
export function parsePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

/** Offset for a 1-based page at the panel's fixed page size. */
export function pageOffset(page: number): number {
  return (Math.max(1, page) - 1) * PANEL_PAGE_SIZE;
}

/** Last page for a total; an empty list still has one (empty) page. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PANEL_PAGE_SIZE));
}

/**
 * Panel href with the page and the active filters. `page=1` is omitted so the
 * canonical list URL stays clean.
 */
export function pageHref(
  path: string,
  filters: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
