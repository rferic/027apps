import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, withTiming } from '@/lib/api/response'
import { createAdminClient } from '@/lib/supabase/admin'
import { readManifest } from '@/lib/apps/manifest'

export const GET = withTiming(async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'any')
  if (auth instanceof Response) return auth

  const adminClient = createAdminClient()
  const { data: activeApps } = await adminClient
    .from('installed_apps')
    .select('slug, visibility')
    .eq('status', 'active')
    .order('display_order')
    .order('installed_at')

  if (!activeApps || activeApps.length === 0) return apiOk([])

  const apps = await Promise.all(
    activeApps.map(async (app) => {
      try {
        const manifest = await readManifest(app.slug)
        return {
          slug: app.slug,
          name: manifest.name,
          description: manifest.description,
          icon_url: manifest.logo ? `/api/apps/${app.slug}/logo` : null,
          status: 'active',
          visibility: app.visibility,
        }
      } catch {
        return null
      }
    })
  )

  return apiOk(apps.filter(Boolean))
})
