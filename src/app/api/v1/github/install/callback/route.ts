import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { encryptSecret } from '@/lib/secrets'

const DEFAULT_LABEL_MAP: Record<string, { name: string; color: string }> = {
  bug: { name: 'bug', color: 'd73a4a' },
  improvement: { name: 'enhancement', color: 'a2eeef' },
  new_app: { name: 'new app', color: '0e8a16' },
  new_app_feature: { name: 'app feature', color: '0e8a16' },
  new_general_functionality: { name: 'feature', color: '0e8a16' },
  other: { name: 'other', color: 'e4e669' },
}

const VALID_LOCALES = ['en', 'es', 'it', 'ca', 'fr', 'de']

function getLocale(req: NextRequest): string {
  const cookie = req.cookies.get('preferred-locale')?.value
  if (cookie && VALID_LOCALES.includes(cookie)) return cookie
  const header = req.headers.get('accept-language')?.slice(0, 2)
  if (header && VALID_LOCALES.includes(header)) return header
  return 'en'
}

export async function GET(req: NextRequest) {
  const locale = getLocale(req)
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const installationId = url.searchParams.get('installation_id')
  const base = `/${locale}/admin/apps/inspiration`

  console.log('[GH-Callback] URL:', req.url)
  console.log('[GH-Callback] Code:', code ? 'present' : 'MISSING')
  console.log('[GH-Callback] Installation ID:', installationId ?? 'MISSING')

  if (!code) {
    return NextResponse.redirect(new URL(`${base}?tab=settings&error=missing_code`, req.url))
  }

  try {
    const response = await fetch('https://api.github.com/app-manifests/' + code + '/conversions', {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (!response.ok) {
      const body = await response.text()
      return NextResponse.redirect(
        new URL(`${base}?tab=settings&error=github_error&detail=` + encodeURIComponent(body), req.url)
      )
    }

    const data = await response.json()

    console.log('[GH-Callback] Exchanging code for credentials...')
    console.log('[GH-Callback] App ID:', data.id, 'Slug:', data.slug)

    // Save ALL settings in a SINGLE update to avoid race conditions
    const githubConfig: Record<string, unknown> = {
      app_id: String(data.id),
      slug: data.slug,
      repo: null,
      webhook_secret: data.webhook_secret,
      sync_enabled: false,
      label_map: DEFAULT_LABEL_MAP,
    }

    try {
      githubConfig.private_key = encryptSecret(data.pem)
    } catch (e) {
      console.error('[GH-Callback] Failed to encrypt private_key:', e)
      throw e
    }

    if (installationId) {
      githubConfig.installation_id = parseInt(installationId, 10)
    }

    // Merge into installed_apps.config.github
    const supabase = createAdminClientUntyped()
    const { data: app } = await supabase
      .from('installed_apps')
      .select('config')
      .eq('slug', 'inspiration')
      .single()

    const config = (app?.config as Record<string, unknown>) ?? {}
    config.github = githubConfig

    const { error: updateError } = await supabase
      .from('installed_apps')
      .update({ config: config as any })
      .eq('slug', 'inspiration')

    if (updateError) {
      console.error('[GH-Callback] Failed to update config:', updateError)
      throw new Error(updateError.message)
    }

    console.log('[GH-Callback] All settings saved successfully')

    return NextResponse.redirect(new URL(`${base}?tab=settings&success=1`, req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`${base}?tab=settings&error=exception&detail=` + encodeURIComponent(msg), req.url)
    )
  }
}
