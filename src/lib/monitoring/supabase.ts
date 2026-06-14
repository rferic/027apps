import type { Metric, MonitoringProvider, ProviderDefinition } from './types'
import { registerProvider } from './registry'

const DEFINITION: ProviderDefinition = {
  id: 'supabase',
  name: 'Supabase',
  description: 'Consumo del plan Supabase (DB, Auth, Storage)',
  icon: '⚡',
  fields: [
    { key: 'projectRef', label: 'Project Reference', type: 'text', placeholder: 'ej. zbwvvzeljiymwqcbemyy' },
    { key: 'serviceKey', label: 'Service Role Key', type: 'password', placeholder: 'Supabase Dashboard → Settings → API' },
  ],
}

async function supabaseApi(projectRef: string, serviceKey: string, path: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase API error (${res.status}): ${body}`)
  }
  return res.json()
}

async function validate(config: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
  try {
    await supabaseApi(config.projectRef, config.serviceKey, '')
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Connection failed' }
  }
}

async function fetchUsage(config: Record<string, string>): Promise<Metric[]> {
  const data = await supabaseApi(config.projectRef, config.serviceKey, '/usage') as Record<string, unknown>
  const metrics: Metric[] = []

  const dbSize = data.db_size as { used: number; limit: number } | undefined
  if (dbSize) {
    metrics.push({
      key: 'supabase_db_size',
      label: 'Base de datos',
      used: Math.round(dbSize.used / 1048576 * 100) / 100,
      limit: Math.round(dbSize.limit / 1048576 * 100) / 100,
      unit: 'MB',
    })
  }

  const auth = data.auth_requests as { used: number; limit: number } | undefined
  if (auth) {
    metrics.push({
      key: 'supabase_auth',
      label: 'Auth requests',
      used: auth.used,
      limit: auth.limit,
      unit: 'requests',
    })
  }

  const storage = data.storage as { used: number; limit: number } | undefined
  if (storage) {
    const usedMb = Math.round(storage.used / 1048576 * 100) / 100
    const limitMb = Math.round(storage.limit / 1048576 * 100) / 100
    metrics.push({
      key: 'supabase_storage',
      label: 'Almacenamiento',
      used: usedMb,
      limit: limitMb,
      unit: 'MB',
    })
  }

  return metrics
}

const provider: MonitoringProvider = { definition: DEFINITION, validate, fetchUsage }

export function registerSupabaseProvider(): void {
  registerProvider(provider)
}
