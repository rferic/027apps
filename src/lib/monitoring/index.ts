import type { Metric, ProviderDefinition, MonitoringProvider } from './types'
import { registerProvider } from './registry'
import { registerVercelProvider } from './vercel'
import { registerSupabaseProvider } from './supabase'

export { getAllDefinitions, getAllProviders, getProvider } from './registry'
export type { Metric, ProviderDefinition, ConfigField, MonitoringProvider } from './types'

// Register all built-in providers
registerVercelProvider()
registerSupabaseProvider()
