import { NextRequest, NextResponse } from 'next/server'
import { setAppSetting } from '@/lib/use-cases/app-settings'
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

    const saves: Promise<void>[] = [
      setAppSetting('github_app_id', String(data.id)).catch(e => { console.error('[GH-Callback] Failed to save app_id:', e); throw e }),
      setAppSetting('github_slug', data.slug).catch(e => { console.error('[GH-Callback] Failed to save slug:', e); throw e }),
      setAppSetting('github_repo', null).catch(e => { console.error('[GH-Callback] Failed to save repo:', e); throw e }),
      setAppSetting('github_webhook_secret', data.webhook_secret).catch(e => { console.error('[GH-Callback] Failed to save webhook_secret:', e); throw e }),
      setAppSetting('github_sync_enabled', false).catch(e => { console.error('[GH-Callback] Failed to save sync_enabled:', e); throw e }),
      setAppSetting('github_label_map', DEFAULT_LABEL_MAP).catch(e => { console.error('[GH-Callback] Failed to save label_map:', e); throw e }),
    ]

    try {
      saves.push(setAppSetting('github_private_key', encryptSecret(data.pem)))
    } catch (e) {
      console.error('[GH-Callback] Failed to encrypt/save private_key:', e)
      throw e
    }

    if (installationId) {
      saves.push(
        setAppSetting('github_installation_id', parseInt(installationId, 10))
          .catch(e => { console.error('[GH-Callback] Failed to save installation_id:', e); throw e })
      )
    }

    await Promise.all(saves)
    console.log('[GH-Callback] All settings saved successfully')

    return NextResponse.redirect(new URL(`${base}?tab=settings&success=1`, req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`${base}?tab=settings&error=exception&detail=` + encodeURIComponent(msg), req.url)
    )
  }
}
