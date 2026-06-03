import { promises as fs } from 'fs'
import path from 'path'
import type { Dirent } from 'fs'
import type { ScannedApp } from '@/types/apps'
import { AppValidationError } from '@/types/apps'
import { readManifest } from '@/lib/apps/manifest'
import { createAdminClient } from '@/lib/supabase/admin'

export async function scanApps(): Promise<ScannedApp[]> {
  const appsDir = path.join(process.cwd(), 'apps')
  let entries: Dirent[]
  try {
    entries = await fs.readdir(appsDir, { withFileTypes: true })
  } catch {
    return []
  }

  const results: ScannedApp[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const slug = entry.name
    try {
      const manifest = await readManifest(slug)
      results.push({ slug, manifest, validationError: null })
    } catch (err) {
      const msg = err instanceof AppValidationError ? err.message : `Unexpected error: ${String(err)}`
      results.push({ slug, manifest: null, validationError: msg })
    }
  }
  return results
}

const SLUGS_QUERY_TIMEOUT_MS = 2000
const SLUGS_CACHE_TTL_MS = 60_000 // 1 minute

let slugsCache: { slugs: string[]; expiresAt: number } | null = null
let slugsInflight: Promise<string[]> | null = null

export function invalidateSlugsCache(): void {
  slugsCache = null
}

export async function scanInstalledAppSlugs(): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }

  // Return cached value if still valid
  if (slugsCache && Date.now() < slugsCache.expiresAt) {
    return slugsCache.slugs
  }

  // Deduplicate concurrent requests — only one query at a time
  if (slugsInflight) return slugsInflight

  slugsInflight = (async (): Promise<string[]> => {
    try {
      const admin = createAdminClient()

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SLUGS_QUERY_TIMEOUT_MS)
      )

      const result = await Promise.race([
        admin.from('installed_apps').select('slug').eq('status', 'active'),
        timeoutPromise,
      ])

      if (result === null) {
        console.warn('[apps] scanInstalledAppSlugs timeout')
        return []
      }

      const { data, error } = result
      if (error) {
        console.error('[apps] scanInstalledAppSlugs failed:', error.message)
        return []
      }

      const slugs = (data ?? []).map((r: { slug: string }) => r.slug)
      slugsCache = { slugs, expiresAt: Date.now() + SLUGS_CACHE_TTL_MS }
      return slugs
    } catch (err) {
      console.error('[apps] scanInstalledAppSlugs error:', err)
      return []
    } finally {
      slugsInflight = null
    }
  })()

  return slugsInflight
}

/** Invalidate the slugs cache (call after install/uninstall). */
export function invalidateInstalledAppSlugsCache(): void {
  slugsCache = null
}
