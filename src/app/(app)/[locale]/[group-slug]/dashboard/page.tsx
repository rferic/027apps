import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readManifest } from '@/lib/apps/manifest'
import { resolveGroupContext } from '@/lib/groups/context'
import { Sparkles } from 'lucide-react'
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
      const mod = await import(
        /* webpackIgnore: true */
        `${process.cwd()}/apps/${app.slug}/widget`
      ) as { default: React.ComponentType }
      results.push({ slug: app.slug, Component: mod.default })
    } catch {
      // App has no valid widget — skip silently
    }
  }
  return results
}

async function loadAppWidgets(groupId: string): Promise<AppWidgetData[]> {
  const adminClient = createAdminClient()
  const { data: installedApps } = await adminClient
    .from('installed_apps')
    .select('slug, visibility')
    .eq('status', 'active')

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
      results.push({
        slug: app.slug,
        name: manifest.name,
        description: manifest.description,
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
        <div key={i} className="bg-white rounded-xl border border-slate-100 h-40 animate-pulse" />
      ))}
    </div>
  )
}

async function WidgetGrid({ locale, groupId }: { locale: string; groupId: string }) {
  const [widgets, t] = await Promise.all([
    loadWidgets(groupId),
    getTranslations('app'),
  ])

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t('dashboard.welcome_title')}</h2>
        <p className="text-sm text-slate-400">{t('dashboard.welcome_subtitle')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {widgets.map(({ slug, Component }) => (
        <div key={slug} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <Component />
        </div>
      ))}
    </div>
  )
}

interface Props {
  params: Promise<{ locale: string; 'group-slug': string }>
}

export default async function DashboardPage({ params }: Props) {
  const { locale, 'group-slug': groupSlug } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const groupCtx = await resolveGroupContext(groupSlug, user.id)
  if (!groupCtx) redirect(`/${locale}/`)

  const apps = await loadAppWidgets(groupCtx.id)

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <AppInstalledWidget apps={apps} locale={locale} groupSlug={groupSlug} />
      <Suspense fallback={<DashboardSkeleton />}>
        <WidgetGrid locale={locale} groupId={groupCtx.id} />
      </Suspense>
    </main>
  )
}

export { DashboardSkeleton }
