/**
 * Rate limiting storage port (ADR 0004: use cases receive infrastructure via
 * injection). The port keeps the door free of database details; tests use an
 * in-memory fake and production injects a Postgres-backed adapter.
 */

export interface RateLimitStorage {
  /**
   * Atomically increments the counter for `key` in the window that starts at
   * `windowStart`, and returns the new count. Concurrent callers must never
   * lose an increment.
   */
  increment(key: string, windowStart: Date, expiresAt: Date): Promise<{ count: number }>;
}

/** Minimal query surface the adapter needs; satisfied by a `pg` client or pool. */
export interface QueryClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const INCREMENT_SQL = `
  INSERT INTO rate_limit_counters (key, window_start, count, expires_at)
  VALUES ($1, $2, 1, $3)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limit_counters.count + 1
  RETURNING count
`;

/**
 * Postgres adapter over `rate_limit_counters`. The upsert is a single atomic
 * statement, so parallel requests from the same identity cannot lose counts.
 * The table is server-internal (RLS denies anon/authenticated); the injected
 * client must run with the service role.
 */
export function createPostgresRateLimitStorage(client: QueryClient): RateLimitStorage {
  return {
    async increment(key, windowStart, expiresAt) {
      const { rows } = await client.query(INCREMENT_SQL, [key, windowStart, expiresAt]);
      const row = rows[0];
      if (!row) {
        throw new Error('rate_limit_counters upsert returned no row');
      }
      return { count: Number(row.count) };
    },
  };
}
