import { setRequestLocale } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MobileVersionManager } from './MobileVersionManager'

interface Props {
  params: Promise<{ locale: string }>
}

interface MobileVersion {
  latest_version: string
  min_version: string
  download_url: string | null
  release_notes: string | null
  apk_path: string | null
}

async function loadVariant(admin: ReturnType<typeof createAdminClient>, key: string, label: string) {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  let version: MobileVersion | null = null
  if (setting?.value && typeof setting.value === 'object') {
    const v = setting.value as Record<string, unknown>
    version = {
      latest_version: typeof v.latest_version === 'string' ? v.latest_version : '1.0.0',
      min_version: typeof v.min_version === 'string' ? v.min_version : '1.0.0',
      download_url: typeof v.download_url === 'string' ? v.download_url : null,
      release_notes: typeof v.release_notes === 'string' ? v.release_notes : null,
      apk_path: typeof v.apk_path === 'string' ? v.apk_path : null,
    }
  }
  return { label, key, version }
}

export default async function MobileVersionPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const admin = createAdminClient()

  const [production, beta] = await Promise.all([
    loadVariant(admin, 'mobile_version', 'Production'),
    loadVariant(admin, 'mobile_version_beta', 'Beta'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mobile App</h1>
        <p className="text-sm text-slate-400 mt-1">Manage mobile app versions and distribution</p>
      </div>

      <MobileVersionManager
        label={production.label}
        settingsKey={production.key}
        current={production.version}
      />

      <MobileVersionManager
        label={beta.label}
        settingsKey={beta.key}
        current={beta.version}
      />
    </div>
  )
}
