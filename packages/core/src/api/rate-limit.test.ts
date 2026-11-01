import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rate-limit';
import { createPostgresRateLimitStorage } from './rate-limit-storage';
import type { RateLimitStorage } from './rate-limit-storage';

interface Call {
  key: string;
  windowStart: Date;
  expiresAt: Date;
}

/** In-memory fake: same key+window increments, a new window starts at zero. */
function createFakeStorage() {
  const counters = new Map<string, number>();
  const calls: Call[] = [];
  const storage: RateLimitStorage = {
    async increment(key, windowStart, expiresAt) {
      calls.push({ key, windowStart, expiresAt });
      const composite = `${key}|${windowStart.toISOString()}`;
      const count = (counters.get(composite) ?? 0) + 1;
      counters.set(composite, count);
      return { count };
    },
  };
  return { storage, calls };
}

const WINDOW = { limit: 2, windowSeconds: 60 } as const;

describe('checkRateLimit', () => {
  it('increments the counter on every call from the same identity', async () => {
    const { storage } = createFakeStorage();
    const now = new Date('2026-11-01T12:00:10.000Z');

    const first = await checkRateLimit(storage, 'user:a', WINDOW, now);
    const second = await checkRateLimit(storage, 'user:a', WINDOW, now);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
  });

  it('shares the window for two calls in the same minute', async () => {
    const { storage, calls } = createFakeStorage();

    await checkRateLimit(storage, 'user:a', WINDOW, new Date('2026-11-01T12:00:10.000Z'));
    await checkRateLimit(storage, 'user:a', WINDOW, new Date('2026-11-01T12:00:50.000Z'));

    expect(calls[0].windowStart.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(calls[1].windowStart.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(calls[1].expiresAt.toISOString()).toBe('2026-11-01T12:01:00.000Z');
  });

  it('opens a new window in a different minute', async () => {
    const { storage, calls } = createFakeStorage();

    const end = await checkRateLimit(storage, 'user:a', WINDOW, new Date('2026-11-01T12:00:59.000Z'));
    const next = await checkRateLimit(storage, 'user:a', WINDOW, new Date('2026-11-01T12:01:00.000Z'));

    expect(calls[0].windowStart.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(calls[1].windowStart.toISOString()).toBe('2026-11-01T12:01:00.000Z');
    expect(end.count).toBe(1);
    expect(next.count).toBe(1);
  });

  it('allows up to the limit and blocks the request above it', async () => {
    const { storage } = createFakeStorage();
    const now = new Date('2026-11-01T12:00:10.000Z');

    const first = await checkRateLimit(storage, 'user:a', WINDOW, now);
    const second = await checkRateLimit(storage, 'user:a', WINDOW, now);
    const third = await checkRateLimit(storage, 'user:a', WINDOW, now);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it('returns the seconds left in the window for Retry-After', async () => {
    const { storage } = createFakeStorage();
    const result = await checkRateLimit(storage, 'user:a', WINDOW, new Date('2026-11-01T12:00:10.000Z'));
    expect(result.retryAfterSeconds).toBe(50);
  });

  it('keeps identities independent', async () => {
    const { storage } = createFakeStorage();
    const now = new Date('2026-11-01T12:00:10.000Z');

    const a1 = await checkRateLimit(storage, 'user:a', WINDOW, now);
    const b1 = await checkRateLimit(storage, 'user:b', WINDOW, now);
    const a2 = await checkRateLimit(storage, 'user:a', WINDOW, now);

    expect(a1.count).toBe(1);
    expect(b1.count).toBe(1);
    expect(a2.count).toBe(2);
  });
});

describe('createPostgresRateLimitStorage', () => {
  it('runs one atomic upsert with key, window start and expiry', async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      async query(sql: string, params?: unknown[]) {
        calls.push({ sql, params });
        return { rows: [{ count: 7 }] };
      },
    };
    const storage = createPostgresRateLimitStorage(client);
    const windowStart = new Date('2026-11-01T12:00:00.000Z');
    const expiresAt = new Date('2026-11-01T12:01:00.000Z');

    const result = await storage.increment('user:a', windowStart, expiresAt);

    expect(result.count).toBe(7);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('ON CONFLICT (key, window_start)');
    expect(calls[0].sql).toContain('count = rate_limit_counters.count + 1');
    expect(calls[0].params).toEqual(['user:a', windowStart, expiresAt]);
  });

  it('throws when the upsert returns no row', async () => {
    const client = {
      async query() {
        return { rows: [] };
      },
    };
    const storage = createPostgresRateLimitStorage(client);

    await expect(storage.increment('k', new Date(), new Date())).rejects.toThrow('no row');
  });
});
