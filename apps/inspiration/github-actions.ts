'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/helpers'
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/lib/use-cases/app-settings'
import { encryptSecret, decryptSecret } from '@/lib/secrets'

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
  }
}

// ─── Save credentials (manual setup) ────────────────────

export async function saveGitHubCredentials(formData: FormData): Promise<{ error?: string } | undefined> {
  await requireAdmin()

  const appId = formData.get('appId') as string
  const privateKey = formData.get('privateKey') as string
  const installationId = formData.get('installationId') as string

  if (!appId || !privateKey || !installationId) {
    return { error: 'App ID, Private Key, and Installation ID are required' }
  }

  // Validate App ID is numeric
  if (!/^\d+$/.test(appId.trim())) {
    return { error: 'App ID must be a number' }
  }

  // Validate Installation ID is numeric
  if (!/^\d+$/.test(installationId.trim())) {
    return { error: 'Installation ID must be a number' }
  }

  // Validate private key starts with PEM header
  if (!privateKey.trim().startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
      !privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----')) {
    return { error: 'Private Key must be a valid PEM-encoded key' }
  }

  try {
    await Promise.all([
      setAppSetting('github_app_id', appId.trim()),
      setAppSetting('github_installation_id', parseInt(installationId.trim(), 10)),
      setAppSetting('github_private_key', encryptSecret(privateKey.trim())),
    ])

    revalidatePath('/admin/settings/github')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save credentials' }
  }
}

// ─── Save webhook secret ─────────────────────────────────

export async function saveWebhookSecret(formData: FormData): Promise<{ error?: string } | undefined> {
  await requireAdmin()

  const secret = formData.get('webhookSecret') as string
  if (!secret) return { error: 'Webhook secret is required' }

  await setAppSetting('github_webhook_secret', secret)
  revalidatePath('/admin/settings/github')
}

// ─── Get manifest JSON (for POST form) ───────────────────

export async function getManifestJson(clientOrigin: string): Promise<string> {
  await requireAdmin()
  const manifest = {
    name: '027apps Inspiration',
    url: clientOrigin,
    redirect_url: `${clientOrigin}/api/v1/github/install/callback`,
    callback_urls: [`${clientOrigin}/api/v1/github/install/callback`],
    default_events: ['issues', 'issue_comment'],
    default_permissions: {
      issues: 'write',
      metadata: 'read',
    },
  }
  return JSON.stringify(manifest)
}

// ─── Test connection ─────────────────────────────────────

export async function testGitHubConnection(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  try {
    const { getInstallationToken } = await import('@/lib/use-cases/inspiration/github')
    await getInstallationToken()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
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

// ─── Fetch repositories ─────────────────────────────────

export async function fetchRepos(): Promise<string[]> {
  await requireAdmin()

  try {
    const { getInstallationToken } = await import('@/lib/use-cases/inspiration/github')
    const token = await getInstallationToken()

    const response = await fetch('https://api.github.com/installation/repositories', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`GitHub API error: ${response.status} — ${body}`)
    }

    const data = await response.json()
    const repos: string[] = (data.repositories ?? []).map((r: { full_name: string }) => r.full_name)
    repos.sort()
    return repos
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to fetch repositories')
  }
}

// ─── Disconnect ──────────────────────────────────────────

export async function disconnectGitHub(): Promise<void> {
  await requireAdmin()

  await Promise.all([
    deleteAppSetting('github_app_id'),
    deleteAppSetting('github_installation_id'),
    deleteAppSetting('github_repo'),
    deleteAppSetting('github_webhook_secret'),
    deleteAppSetting('github_sync_enabled'),
    deleteAppSetting('github_label_map'),
    deleteAppSetting('github_private_key'),
  ])

  revalidatePath('/admin/settings/github')
}
