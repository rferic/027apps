import { z } from "zod";

/** Default page size for every paginated list endpoint. */
export const DEFAULT_LIST_LIMIT = 20;
/** Hard cap: one page never returns more than this many rows. */
export const MAX_LIST_LIMIT = 100;

export interface PageParams {
  limit: number;
  offset: number;
}

/**
 * `limit`/`offset` from the query string, clamped instead of rejected: a
 * malformed or out-of-range value never turns a read into a 400. Invalid text
 * falls back to the default, out-of-range numbers are capped.
 */
export function pageParams(
  searchParams: URLSearchParams,
  defaultLimit: number = DEFAULT_LIST_LIMIT,
): PageParams {
  const limit = z.coerce
    .number()
    .catch(defaultLimit)
    .transform((value) => Math.min(MAX_LIST_LIMIT, Math.max(1, Math.trunc(value))))
    .parse(searchParams.get("limit") ?? defaultLimit);
  const offset = z.coerce
    .number()
    .catch(0)
    .transform((value) => Math.max(0, Math.trunc(value)))
    .parse(searchParams.get("offset") ?? 0);
  return { limit, offset };
}
