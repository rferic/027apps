/**
 * ESTRATEGIA DE CACHÉ — 027apps
 * =============================
 *
 * ## Principios
 *
 * 1. Cacheamos operaciones de LECTURA pesadas que se ejecutan en cada request.
 * 2. NO cacheamos operaciones de ESCRITURA ni datos de un solo usuario.
 * 3. Toda caché tiene un TTL + tags de invalidación explícita.
 *
 * ## Funciones cacheadas actualmente (Sprint 16)
 *
 * | Función | TTL | Tags | Dónde se usa |
 * |---|---|---|---|
 * | `getAdminStats` | 1h | `admin-stats` | Admin dashboard |
 * | `getAdminUserList` | 5min | `admin-users` | Admin users list |
 * | `readManifest(slug)` | 7d | `manifest` | Todos los layouts |
 * | `getUserGroups(userId)` | 1h | `user-groups` | Layout público |
 *
 * ## Invalidación
 *
 * Las cachés se invalidan desde Server Actions vía `revalidateTag()`:
 *
 * - `installAppAction` → invalida `apps-list`, `admin-stats`, `manifest`
 * - `uninstallAppAction` → invalida `apps-list`, `admin-stats`, `manifest`
 *
 * ## Por qué cachedQuery y no use cache directive
 *
 * Next.js 16 introduce `"use cache"` directive, pero no tenemos
 * PPR activado (incompatible con Fumadocs). Hasta que se resuelva,
 * usamos `unstable_cache` envuelto en `cachedQuery` que:
 *
 * - Se desactiva automáticamente en tests (VITEST env)
 * - Hace lazy import de `next/cache` para evitar errores en build
 * - Tiene tipado completo genérico
 *
 * ## PPR (Pendiente)
 *
 * Activar PPR requiere migrar Fumadocs a una estrategia sin
 * generateStaticParams, o esperar compatibilidad. Pendiente.
 */

interface CacheOptions {
  revalidate: number
  tags: string[]
}

/**
 * Wraps an async function with Next.js unstable_cache.
 * In test environments, returns the function as-is to avoid
 * module-resolution issues with next/cache in vitest/jsdom.
 *
 * @param fn - The async function to cache
 * @param keyParts - Unique key parts for cache identity
 * @param options - Cache options (revalidate seconds + tags)
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
