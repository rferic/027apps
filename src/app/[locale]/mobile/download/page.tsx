import { setRequestLocale } from 'next-intl/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { DownloadLinks } from './DownloadLinks'

interface Props {
  params: Promise<{ locale: string }>
}

interface VersionInfo {
  latest_version: string
  min_version: string
  download_url: string
  release_notes: string | null
}

async function getVersion(key: string, label: string): Promise<{ label: string; version: VersionInfo | null }> {
  const db = await createServerClient()
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error || !data?.value || typeof data.value !== 'object') {
    return { label, version: null }
  }

  const v = data.value as Record<string, unknown>
  return {
    label,
    version: {
      latest_version: typeof v.latest_version === 'string' ? v.latest_version : '—',
      min_version: typeof v.min_version === 'string' ? v.min_version : '—',
      download_url: typeof v.download_url === 'string' ? v.download_url : '',
      release_notes: typeof v.release_notes === 'string' ? v.release_notes : null,
    },
  }
}

export default async function MobileDownloadPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const [production, beta] = await Promise.all([
    getVersion('mobile_version', 'Production'),
    getVersion('mobile_version_beta', 'Beta'),
  ])

  const variants = [production, beta].filter((v): v is { label: string; version: VersionInfo } => v.version !== null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">027Apps Mobile</h1>
        <p className="text-slate-500">Download the latest APK for your device</p>
      </div>

      <DownloadLinks variants={variants} />

      <p className="mt-10 text-xs text-slate-400 text-center max-w-sm">
        APKs are signed and distributed directly. No Play Store required.
        Enable "Install from unknown sources" in your device settings.
      </p>
    </div>
  )
}
