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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const installationId = searchParams.get('installation_id')

  if (!code || !installationId) {
    return NextResponse.redirect(new URL('/en/admin/apps/inspiration?error=missing_params', req.url))
  }

  try {
    const response = await fetch('https://api.github.com/app-manifests/' + code + '/conversions', {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (!response.ok) {
      const body = await response.text()
      return NextResponse.redirect(
        new URL('/en/admin/settings/github?error=github_error&detail=' + encodeURIComponent(body), req.url)
      )
    }

    const data = await response.json()

    await Promise.all([
      setAppSetting('github_app_id', String(data.id)),
      setAppSetting('github_slug', data.slug),
      setAppSetting('github_installation_id', parseInt(installationId, 10)),
      setAppSetting('github_repo', null),
      setAppSetting('github_webhook_secret', data.webhook_secret),
      setAppSetting('github_sync_enabled', false),
      setAppSetting('github_label_map', DEFAULT_LABEL_MAP),
      setAppSetting('github_private_key', encryptSecret(data.pem)),
    ])

    return NextResponse.redirect(new URL('/en/admin/apps/inspiration?success=1', req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL('/en/admin/apps/inspiration?error=exception&detail=' + encodeURIComponent(msg), req.url)
    )
  }
}
