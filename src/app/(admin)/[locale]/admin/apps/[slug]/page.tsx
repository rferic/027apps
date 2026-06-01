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
import { loadAppModule, hasAppModule } from '@/lib/apps/registry'

const SLUG_RE = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function AdminAppViewPage({ params }: Props) {
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header with logo */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src={`/api/apps/${slug}/logo`}
          alt={manifest.name}
          className="w-10 h-10 rounded-lg flex-shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{manifest.name}</h1>
          <p className="text-sm text-gray-500">{manifest.description}</p>
        </div>
      </div>

      <AdminAppTabs
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
