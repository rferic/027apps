import { setRequestLocale, getTranslations } from 'next-intl/server'
import { getAllDefinitions } from '@/lib/monitoring'
import { getProviderConfigAction } from './actions'
import { MonitoringManager } from './MonitoringManager'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function MonitoringPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.settings.monitoring')

  const definitions = getAllDefinitions()
  const configs: Record<string, Record<string, string>> = {}
  try {
    for (const def of definitions) {
      configs[def.id] = await getProviderConfigAction(def.id)
    }
  } catch {
    // Continue with empty configs if settings fetch fails
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
      </div>
      <MonitoringManager definitions={definitions} initialConfigs={configs} />
    </div>
  )
}
