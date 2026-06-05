interface CacheOptions {
  revalidate: number
  tags: string[]
}

/**
 * Wraps an async function with Next.js unstable_cache.
 * In test environments, returns the function as-is to avoid
 * module-resolution issues with next/cache in vitest/jsdom.
 */
export function cachedQuery<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: CacheOptions
): (...args: Args) => Promise<Result> {
  let cachedFn: ((...args: Args) => Promise<Result>) | null = null

  return async (...args: Args): Promise<Result> => {
    // In vitest, skip caching entirely.
    if (typeof process !== 'undefined' && process.env?.VITEST) {
      return fn(...args)
    }

    // Lazy-init unstable_cache on first call.
    if (!cachedFn) {
      const { unstable_cache } = await import('next/cache')
      cachedFn = unstable_cache(fn, keyParts as unknown as string[], options) as unknown as (...a: Args) => Promise<Result>
    }

    return cachedFn(...args)
  }
}
