import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readManifest } from '@/lib/apps/manifest'
import { resolveGroupContext } from '@/lib/groups/context'
import { loadAppModule } from '@/lib/apps/registry'
import { loadAppMessages } from '@/lib/apps/i18n'
import { DsSkeleton } from '@/components/ds/skeleton'
import { DsEmptyState } from '@/components/ds/empty-state'
import { DsCard } from '@/components/ds/card'
import { AppInstalledWidget } from '@/components/app-installed-widget'

const SLUG_RE = /^[a-z0-9-]+$/

interface WidgetEntry {
  slug: string
  Component: React.ComponentType
}

interface AppWidgetData {
  slug: string
  name: string
  description: string
  primaryColor: string
  secondaryColor: string
}

async function loadWidgets(groupId: string): Promise<WidgetEntry[]> {
  const adminClient = createAdminClient()
  const { data: installedApps } = await adminClient
    .from('installed_apps')
    .select('slug, visibility')
    .eq('status', 'active')
    .order('display_order')
    .order('installed_at')

  const { data: accessRows } = await adminClient
    .from('group_app_access')
    .select('app_slug')
    .eq('group_id', groupId)
  const accessSet = new Set((accessRows ?? []).map(r => r.app_slug))

  const results: WidgetEntry[] = []
  for (const app of installedApps ?? []) {
    if (!SLUG_RE.test(app.slug)) continue
    if (app.visibility === 'private' && !accessSet.has(app.slug)) continue
    try {
      const manifest = await readManifest(app.slug)
      if (!manifest.views.widget) continue
      const Component = await loadAppModule(app.slug, 'widget') as React.ComponentType
      results.push({ slug: app.slug, Component })
    } catch {
      // App has no valid widget — skip silently
    }
  }
  return results
}

async function loadAppWidgets(locale: string, groupId: string): Promise<AppWidgetData[]> {
  const adminClient = createAdminClient()
  const { data: installedApps } = await adminClient
    .from('installed_apps')
    .select('slug, visibility')
    .eq('status', 'active')
    .order('display_order')
    .order('installed_at')

  // Load group_app_access for private apps
  const { data: accessRows } = await adminClient
    .from('group_app_access')
    .select('app_slug')
    .eq('group_id', groupId)
  const accessSet = new Set((accessRows ?? []).map(r => r.app_slug))

  const results: AppWidgetData[] = []
  for (const app of installedApps ?? []) {
    if (!SLUG_RE.test(app.slug)) continue
    // Skip private apps the group doesn't have access to
    if (app.visibility === 'private' && !accessSet.has(app.slug)) continue
    try {
      const manifest = await readManifest(app.slug)
      const messages = await loadAppMessages(app.slug, locale)
      results.push({
        slug: app.slug,
        name: manifest.name,
        description: (messages.description as string) ?? manifest.description,
        primaryColor: manifest.primaryColor,
        secondaryColor: manifest.secondaryColor,
      })
    } catch {
      // Skip invalid manifests
    }
  }
  return results
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <DsCard key={i} padding="md" hover={false}>
          <DsSkeleton height={120} />
          <div style={{ height: 12 }} />
          <DsSkeleton height={14} count={2} />
        </DsCard>
      ))}
    </div>
  )
}

async function WidgetGrid({ groupId }: { locale: string; groupId: string }) {
  const [widgets, t] = await Promise.all([
    loadWidgets(groupId),
    getTranslations('app'),
  ])

  if (widgets.length === 0) {
    return (
      <DsEmptyState
        icon="✨"
        title={t('dashboard.welcome_title')}
        description={t('dashboard.welcome_subtitle')}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {widgets.map(({ slug, Component }) => (
        <DsCard key={slug} padding="md" hover={false}>
          <Component />
        </DsCard>
      ))}
    </div>
  )
}

interface Props {
  params: Promise<{ locale: string; 'group-slug': string }>
}

async function AppInstalledWidgetAsync({ locale, groupId, groupSlug }: { locale: string; groupId: string; groupSlug: string }) {
  const apps = await loadAppWidgets(locale, groupId)
  return <AppInstalledWidget apps={apps} locale={locale} groupSlug={groupSlug} />
}

export default async function DashboardPage({ params }: Props) {
  const { locale, 'group-slug': groupSlug } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const groupCtx = await resolveGroupContext(groupSlug, user.id)
  if (!groupCtx) redirect(`/${locale}/`)

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <Suspense fallback={<DashboardSkeleton />}>
        <AppInstalledWidgetAsync locale={locale} groupId={groupCtx.id} groupSlug={groupSlug} />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <WidgetGrid locale={locale} groupId={groupCtx.id} />
      </Suspense>
    </main>
  )
}


