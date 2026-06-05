import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readManifest } from '@/lib/apps/manifest'
import { AppsOrderManager } from './AppsOrderManager'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AppsOrderPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.settings.apps')

  const adminClient = createAdminClient()
  const { data: activeApps } = await adminClient
    .from('installed_apps')
    .select('slug')
    .eq('status', 'active')
    .order('display_order')
    .order('installed_at')

  const apps: { slug: string; name: string; primaryColor: string }[] = []
  if (activeApps) {
    for (const app of activeApps) {
      try {
        const manifest = await readManifest(app.slug)
        apps.push({
          slug: app.slug,
          name: manifest.name,
          primaryColor: manifest.primaryColor,
        })
      } catch {
        // skip apps with invalid manifests
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
      </div>
      <AppsOrderManager initialApps={apps} />
    </div>
  )
}
