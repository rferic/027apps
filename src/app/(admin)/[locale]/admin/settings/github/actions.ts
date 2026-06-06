'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/helpers'
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/lib/use-cases/app-settings'
import { encryptSecret } from '@/lib/secrets'

// ─── Types ───────────────────────────────────────────────

export interface GitHubSettings {
  connected: boolean
  appId: string | null
  slug: string | null
  installationId: number | null
  repo: string | null
  syncEnabled: boolean
  labelMap: Record<string, { name: string; color: string }> | null
  webhookConfigured: boolean
  webhookSecret: string | null
}

// ─── Default label map ───────────────────────────────────

const DEFAULT_LABEL_MAP: Record<string, { name: string; color: string }> = {
  bug: { name: 'bug', color: 'd73a4a' },
  improvement: { name: 'enhancement', color: 'a2eeef' },
  new_app: { name: 'new app', color: '0e8a16' },
  new_app_feature: { name: 'app feature', color: '0e8a16' },
  new_general_functionality: { name: 'feature', color: '0e8a16' },
  other: { name: 'other', color: 'e4e669' },
}

// ─── Read current settings ──────────────────────────────

export async function getGitHubSettings(): Promise<GitHubSettings> {
  await requireAdmin()

  const [appId, slug, installationId, repo, webhookSecret, syncEnabled, labelMap] = await Promise.all([
    getAppSetting('github_app_id'),
    getAppSetting('github_slug'),
    getAppSetting('github_installation_id'),
    getAppSetting('github_repo'),
    getAppSetting('github_webhook_secret'),
    getAppSetting('github_sync_enabled'),
    getAppSetting('github_label_map'),
  ])

  const pk = await getAppSetting('github_private_key')

  return {
    connected: !!(appId && pk),
    appId: (appId as string) ?? null,
    slug: (slug as string) ?? null,
    installationId: (installationId as number) ?? null,
    repo: (repo as string) ?? null,
    syncEnabled: !!syncEnabled,
    labelMap: (labelMap as Record<string, { name: string; color: string }>) ?? DEFAULT_LABEL_MAP,
    webhookConfigured: !!webhookSecret,
    webhookSecret: (webhookSecret as string) ?? null,
  }
}

// ─── Generate manifest URL ──────────────────────────────

export async function generateManifestUrl(): Promise<string> {
  await requireAdmin()

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const callbackUrl = `${origin}/admin/settings/github/callback`

  const manifest = {
    name: '027apps Inspiration',
    url: origin,
    hook_attributes: { url: `${origin}/api/v1/github/webhook`, active: true },
    setup_url: `${origin}/admin/settings/github`,
    redirect_url: callbackUrl,
    callback_urls: [callbackUrl],
    public: false,
    default_events: ['issues', 'issue_comment'],
    permissions: {
      issues: 'write',
      metadata: 'read',
    },
  }

  const encoded = Buffer.from(JSON.stringify(manifest)).toString('base64url')
  return `https://github.com/settings/apps/new?manifest=${encoded}`
}

// ─── Handle callback ─────────────────────────────────────

export async function handleGitHubCallback(code: string, installationId: number): Promise<{ ok: true } | { error: string }> {
  await requireAdmin()

  try {
    const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json' },
    })

    if (!response.ok) {
      const body = await response.text()
      return { error: `GitHub API error: ${response.status} — ${body}` }
    }

    const data = await response.json()

    // Store credentials
    await Promise.all([
      setAppSetting('github_app_id', data.id),
      setAppSetting('github_slug', data.slug),
      setAppSetting('github_installation_id', installationId),
      setAppSetting('github_repo', null),
      setAppSetting('github_webhook_secret', data.webhook_secret),
      setAppSetting('github_sync_enabled', false),
      setAppSetting('github_label_map', DEFAULT_LABEL_MAP),
      setAppSetting('github_private_key', encryptSecret(data.pem)),
    ])

    revalidatePath('/admin/settings/github')
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── Toggle sync ─────────────────────────────────────────

export async function toggleGitHubSync(enabled: boolean): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_sync_enabled', enabled)
  revalidatePath('/admin/settings/github')
}

// ─── Update repo ─────────────────────────────────────────

export async function updateGitHubRepo(repo: string): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_repo', repo)
  revalidatePath('/admin/settings/github')
}

// ─── Update label map ────────────────────────────────────

export async function updateLabelMap(
  labelMap: Record<string, { name: string; color: string }>
): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_label_map', labelMap)
  revalidatePath('/admin/settings/github')
}

// ─── Disconnect ──────────────────────────────────────────

export async function disconnectGitHub(): Promise<void> {
  await requireAdmin()

  await Promise.all([
    deleteAppSetting('github_app_id'),
    deleteAppSetting('github_slug'),
    deleteAppSetting('github_installation_id'),
    deleteAppSetting('github_repo'),
    deleteAppSetting('github_webhook_secret'),
    deleteAppSetting('github_sync_enabled'),
    deleteAppSetting('github_label_map'),
    deleteAppSetting('github_private_key'),
  ])

  revalidatePath('/admin/settings/github')
}
