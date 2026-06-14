export interface Metric {
  key: string
  label: string
  used: number
  limit: number
  unit: string
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
}

export interface ProviderDefinition {
  id: string
  name: string
  description: string
  icon: string
  fields: ConfigField[]
}

export interface MonitoringProvider {
  definition: ProviderDefinition
  validate(config: Record<string, string>): Promise<{ valid: boolean; error?: string }>
  fetchUsage(config: Record<string, string>): Promise<Metric[]>
}
