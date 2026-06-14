import type { Metric, MonitoringProvider, ProviderDefinition } from './types'

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
    await vercelApi(config.token, '/v1/user')
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Connection failed' }
  }
}

async function fetchUsage(config: Record<string, string>): Promise<Metric[]> {
  let data: Record<string, unknown> = {}
  try {
    data = await vercelApi(config.token, '/v1/observations/usage') as Record<string, unknown>
  } catch (e) {
    console.warn('[monitoring] Vercel usage API failed:', e instanceof Error ? e.message : e)
    // If observations endpoint fails, return empty (no data available for this plan)
    return []
  }
  console.log('[monitoring] Vercel API response:', JSON.stringify(data).slice(0, 500))
  const metrics: Metric[] = []

  // Try different response formats
  const src = data.observations ?? data.data ?? data

  const invocations = (src as Record<string, unknown>).invocations as { total?: number; used?: number; limit?: number } | undefined
  if (invocations) {
    metrics.push({
      key: 'vercel_invocations',
      label: 'Invocaciones',
      used: invocations.total ?? invocations.used ?? 0,
      limit: invocations.limit ?? 0,
      unit: 'requests',
    })
  }

  const duration = (src as Record<string, unknown>).duration as { total?: number; used?: number; limit?: number } | undefined
  if (duration) {
    metrics.push({
      key: 'vercel_duration',
      label: 'Tiempo ejecución',
      used: Math.round((duration.total ?? duration.used ?? 0) / 3600),
      limit: Math.round((duration.limit ?? 0) / 3600),
      unit: 'hours',
    })
  }

  const bandwidth = (src as Record<string, unknown>).bandwidth as { total?: number; used?: number; limit?: number } | undefined
  if (bandwidth) {
    metrics.push({
      key: 'vercel_bandwidth',
      label: 'Ancho de banda',
      used: Math.round((bandwidth.total ?? bandwidth.used ?? 0) / 1073741824 * 100) / 100,
      limit: Math.round((bandwidth.limit ?? 0) / 1073741824 * 100) / 100,
      unit: 'GB',
    })
  }

  return metrics
}

export const vercelProvider: MonitoringProvider = { definition: DEFINITION, validate, fetchUsage }
