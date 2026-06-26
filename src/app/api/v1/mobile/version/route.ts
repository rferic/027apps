import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { createApiAdminClient } from '@/lib/supabase/api'

interface MobileVersion {
  latest_version: string
  min_version: string
  download_url: string
  release_notes: string | null
  apk_path: string | null
}

const DEFAULTS: MobileVersion = {
  latest_version: '1.0.0',
  min_version: '1.0.0',
  download_url: '',
  release_notes: null,
  apk_path: null,
}

function getSettingsKey(variant: string): string {
  return variant === 'beta' ? 'mobile_version_beta' : 'mobile_version'
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'public')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const variant = searchParams.get('variant') ?? 'production'

  const admin = createApiAdminClient()
  const { data: setting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', getSettingsKey(variant))
    .maybeSingle()

  let version: MobileVersion = DEFAULTS

  if (setting && setting.value && typeof setting.value === 'object') {
    const v = setting.value as Record<string, unknown>
    version = {
      latest_version: typeof v.latest_version === 'string' ? v.latest_version : DEFAULTS.latest_version,
      min_version: typeof v.min_version === 'string' ? v.min_version : DEFAULTS.min_version,
      download_url: typeof v.download_url === 'string' ? v.download_url : DEFAULTS.download_url,
      release_notes: typeof v.release_notes === 'string' ? v.release_notes : null,
      apk_path: typeof v.apk_path === 'string' ? v.apk_path : null,
    }
  }

  // Build download_url from apk_path if not explicitly set
  if (!version.download_url && version.apk_path) {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/apk-releases`
    version.download_url = `${base}/${version.apk_path}`
  }

  return Response.json({
    latest_version: version.latest_version,
    min_version: version.min_version,
    download_url: version.download_url,
    release_notes: version.release_notes,
  })
}
