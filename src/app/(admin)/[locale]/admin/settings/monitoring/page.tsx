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

  const definitions = getAllDefinitions()
  const configs: Record<string, Record<string, string>> = {}
  for (const def of definitions) {
    configs[def.id] = await getProviderConfigAction(def.id)
  }

  return <MonitoringManager definitions={definitions} initialConfigs={configs} />
}
