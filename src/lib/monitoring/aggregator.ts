import { getAllProviders } from '@/lib/monitoring'
import { getMonitoringSetting } from '@/lib/monitoring/settings'
import type { Metric } from '@/lib/monitoring'

export async function getMonitoringMetrics(): Promise<{ providerName: string; icon: string; metrics: Metric[] }[]> {
  const providers = getAllProviders()
  const results: { providerName: string; icon: string; metrics: Metric[] }[] = []

  for (const provider of providers) {
    const config: Record<string, string> = {}
    for (const field of provider.definition.fields) {
      const value = await getMonitoringSetting(`${provider.definition.id}_${field.key}`)
      if (value) config[field.key] = value
    }

    if (Object.keys(config).length === provider.definition.fields.length) {
      try {
        const metrics = await provider.fetchUsage(config)
        results.push({ providerName: provider.definition.name, icon: provider.definition.icon, metrics })
      } catch (e) {
        console.warn(`[monitoring] ${provider.definition.id} fetchUsage failed:`, e instanceof Error ? e.message : e)
        results.push({ providerName: provider.definition.name, icon: provider.definition.icon, metrics: [] })
      }
    }
  }

  return results
}
