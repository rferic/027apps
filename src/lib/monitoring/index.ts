import type { Metric, MonitoringProvider, ProviderDefinition } from './types'
import { vercelProvider } from './vercel'
import { supabaseProvider } from './supabase'

export type { Metric, ProviderDefinition, ConfigField, MonitoringProvider } from './types'

const builtinProviders: MonitoringProvider[] = [vercelProvider, supabaseProvider]

export function getAllDefinitions(): ProviderDefinition[] {
  return builtinProviders.map(p => p.definition)
}

export function getAllProviders(): MonitoringProvider[] {
  return builtinProviders
}

export function getProvider(id: string): MonitoringProvider | undefined {
  return builtinProviders.find(p => p.definition.id === id)
}
