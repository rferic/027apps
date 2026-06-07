import Image from 'next/image'
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'
import { readManifest } from '@/lib/apps/manifest'
import { AppValidationError } from '@/types/apps'
import { AppConfigSection } from './AppConfigSection'
import { AdminAppPermissions } from '@/components/admin-app-permissions'
import { AdminAppTabs } from './AdminAppTabs'
import { getAppPermissionsAction } from '@/lib/apps/actions'
import { loadAppModule } from '@/lib/apps/registry'
import { loadAppMessages } from '@/lib/apps/i18n'
import { GitHubSettingsManager } from '../../../../../../../apps/inspiration/GitHubSettingsManager'
import { getAppSetting } from '@/lib/use-cases/app-settings'
import { decryptSecret } from '@/lib/secrets'

const SLUG_RE = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ locale: string; slug: string }>
  searchParams?: Promise<{ tab?: string; success?: string }>
}

async function getInitialGitHubSettings() {
  const [appId, slug, installationId, repo, webhookSecret, syncEnabled, labelMap, pk] = await Promise.all([
    getAppSetting('github_app_id'),
    getAppSetting('github_slug'),
    getAppSetting('github_installation_id'),
    getAppSetting('github_repo'),
    getAppSetting('github_webhook_secret'),
    getAppSetting('github_sync_enabled'),
    getAppSetting('github_label_map'),
    getAppSetting('github_private_key'),
  ])

  let privateKeyValid = false
  if (pk && typeof pk === 'string') {
    try { decryptSecret(pk); privateKeyValid = true } catch {}
  }

  return {
    connected: !!(appId && privateKeyValid && installationId),
    appId: (appId as string) ?? null,
    slug: (slug as string) ?? null,
    installationId: (installationId as number) ?? null,
    repo: (repo as string) ?? null,
    syncEnabled: !!syncEnabled,
    labelMap: (labelMap as Record<string, { name: string; color: string }>) ?? null,
    webhookConfigured: !!webhookSecret,
  }
}

export default async function AdminAppViewPage({ params, searchParams }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  if (!SLUG_RE.test(slug)) notFound()

  await requireAdmin()

  const adminClient = createAdminClient()
  const { data: installedApp } = await adminClient
    .from('installed_apps')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!installedApp || installedApp.status !== 'active') notFound()

  const permissionsResult = await getAppPermissionsAction(slug)
  const permissionsGroups = 'groups' in permissionsResult ? permissionsResult.groups : []

  let manifest
  try {
    manifest = await readManifest(slug)
  } catch (err) {
    if (err instanceof AppValidationError) notFound()
    throw err
  }

  let AdminComponent: React.ComponentType | null = null
  if (manifest.views.admin) {
    try {
      AdminComponent = await loadAppModule(slug, 'admin')
    } catch {
      // app declared views.admin but file missing — show page without admin view
    }
  }

  const t = await getTranslations('admin.apps')
  const appMessages = await loadAppMessages(slug, locale)
  const appDescription = (appMessages.description as string) ?? manifest.description

  const sp = searchParams ? await searchParams : undefined

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header with logo */}
      <div className="flex items-center gap-3 mb-6">
        <Image unoptimized
          src={`/api/apps/${slug}/logo`}
          alt={manifest.name}
          width={40}
          height={40}
          className="w-10 h-10 rounded-lg flex-shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{manifest.name}</h1>
          <p className="text-sm text-gray-500">{appDescription}</p>
        </div>
      </div>

      <AdminAppTabs
        defaultValue={sp?.tab === 'settings' ? 'settings' : 'manage'}
        manageLabel={t('manageTab')}
        settingsLabel={t('settingsTab')}
        manageContent={
          AdminComponent ? (
            <AdminComponent />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
              <p className="text-sm text-gray-500">{t('noAdminView')}</p>
            </div>
          )
        }
        settingsContent={
          <>
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('permissions.title')}</h2>
              <AdminAppPermissions
                slug={slug}
                visibility={installedApp.visibility as 'public' | 'private'}
                groups={permissionsGroups}
              />
            </div>

            {slug === 'inspiration' && (
              <div className="bg-white rounded-xl border border-slate-100 p-5 mt-4">
                <GitHubSettingsManager initial={await getInitialGitHubSettings()} />
              </div>
            )}

            {manifest.config.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">{t('configure')}</h2>
                <AppConfigSection
                  slug={slug}
                  fields={manifest.config}
                  savedConfig={(installedApp.config as Record<string, unknown>) ?? {}}
                />
              </div>
            )}
          </>
        }
      />
    </div>
  )
}
