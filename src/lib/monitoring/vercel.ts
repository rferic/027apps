import type { Metric, MonitoringProvider, ProviderDefinition } from './types'
import { registerProvider } from './registry'

const DEFINITION: ProviderDefinition = {
  id: 'vercel',
  name: 'Vercel',
  description: 'Consumo del plan Vercel (invocaciones, ancho de banda, tiempo ejecución)',
  icon: '▲',
  fields: [
    { key: 'token', label: 'API Token', type: 'password', placeholder: 'Crea uno en vercel.com/account/tokens' },
  ],
}

async function vercelApi(token: string, path: string): Promise<unknown> {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Vercel API error (${res.status}): ${body}`)
  }
  return res.json()
}

async function validate(config: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
  try {
    await vercelApi(config.token, '/v1/teams/current')
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Connection failed' }
  }
}

async function fetchUsage(config: Record<string, string>): Promise<Metric[]> {
  const data = await vercelApi(config.token, '/v1/observations/usage') as Record<string, unknown>
  const metrics: Metric[] = []

  const invocations = data.invocations as { total: number; limit: number } | undefined
  if (invocations) {
    metrics.push({
      key: 'vercel_invocations',
      label: 'Invocaciones',
      used: invocations.total,
      limit: invocations.limit,
      unit: 'requests',
    })
  }

  const duration = data.duration as { total: number; limit: number } | undefined
  if (duration) {
    metrics.push({
      key: 'vercel_duration',
      label: 'Tiempo ejecución',
      used: Math.round(duration.total / 3600),
      limit: Math.round(duration.limit / 3600),
      unit: 'hours',
    })
  }

  const bandwidth = data.bandwidth as { total: number; limit: number } | undefined
  if (bandwidth) {
    const usedGb = Math.round(bandwidth.total / 1073741824 * 100) / 100
    const limitGb = Math.round(bandwidth.limit / 1073741824 * 100) / 100
    metrics.push({
      key: 'vercel_bandwidth',
      label: 'Ancho de banda',
      used: usedGb,
      limit: limitGb,
      unit: 'GB',
    })
  }

  return metrics
}

const provider: MonitoringProvider = { definition: DEFINITION, validate, fetchUsage }

export function registerVercelProvider(): void {
  registerProvider(provider)
}
