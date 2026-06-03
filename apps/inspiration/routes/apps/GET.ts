import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { readManifest } from '@/lib/apps/manifest'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  const adminClient = createAdminClientUntyped()

  const { data: installedApps } = await adminClient
    .from('installed_apps')
    .select('slug, visibility')
    .eq('status', 'active')

  if (!installedApps || installedApps.length === 0) {
    return apiOk({ apps: [] })
  }

  const { data: accessRows } = await adminClient
    .from('group_app_access')
    .select('app_slug')
    .eq('group_id', ctx.groupId)
  const accessSet = new Set((accessRows ?? []).map(r => r.app_slug))

  // Filter: public always visible; private needs group_app_access
  const filtered = installedApps.filter(
    (app: { slug: string; visibility: string }) =>
      app.visibility === 'public' || accessSet.has(app.slug)
  )

  // Resolve names from manifests
  const apps = await Promise.all(
    filtered.map(async (app: { slug: string }) => {
      try {
        const manifest = await readManifest(app.slug)
        return { slug: app.slug, name: manifest.name }
      } catch {
        return { slug: app.slug, name: app.slug }
      }
    })
  )

  return apiOk({ apps })
}
