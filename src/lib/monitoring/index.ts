import type { Metric, ProviderDefinition, MonitoringProvider } from './types'
import { registerProvider, getAllDefinitions, getAllProviders, getProvider } from './registry'
import { vercelProvider } from './vercel'
import { supabaseProvider } from './supabase'

export { getAllDefinitions, getAllProviders, getProvider }
export type { Metric, ProviderDefinition, ConfigField, MonitoringProvider } from './types'

// Register all built-in providers eagerly
registerProvider(vercelProvider)
registerProvider(supabaseProvider)
