import type { RateLimitStorage } from './rate-limit-storage';

export interface RateLimitOptions {
  /** Maximum requests allowed inside one window. */
  limit: number;
  /** Window size in seconds (60 → fixed one-minute windows). */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  /** Seconds until the current window expires (for the Retry-After header). */
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limit check. The window is derived from `now` so callers
 * and tests control the clock; the storage does the atomic increment.
 */
export async function checkRateLimit(
  storage: RateLimitStorage,
  key: string,
  options: RateLimitOptions,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowMs = options.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);

  const { count } = await storage.increment(key, windowStart, expiresAt);
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

  return {
    allowed: count <= options.limit,
    count,
    limit: options.limit,
    retryAfterSeconds,
  };
}
