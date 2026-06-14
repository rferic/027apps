import type { Metric, ProviderDefinition, MonitoringProvider } from './types'

const providers = new Map<string, MonitoringProvider>()

export function registerProvider(provider: MonitoringProvider): void {
  providers.set(provider.definition.id, provider)
}

export function getProvider(id: string): MonitoringProvider | undefined {
  return providers.get(id)
}

export function getAllDefinitions(): ProviderDefinition[] {
  return Array.from(providers.values()).map(p => p.definition)
}

export function getAllProviders(): MonitoringProvider[] {
  return Array.from(providers.values())
}
