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
  // Get user info for team context
  const userData = await vercelApi(config.token, '/v1/user') as Record<string, unknown>
  const user = userData.user as Record<string, unknown> | undefined
  const teamId = (user?.defaultTeamId as string) ?? (userData.teamId as string) ?? undefined
  console.log('[monitoring] Vercel user info:', JSON.stringify({ userId: (user?.id as string)?.slice(0, 8), hasTeam: !!teamId }).slice(0, 200))

  const metrics: Metric[] = []

  // Try Observations API
  try {
    const path = teamId ? `/v1/observations/usage?teamId=${teamId}` : '/v1/observations/usage'
    const data = await vercelApi(config.token, path) as Record<string, unknown>
    console.log('[monitoring] Vercel observations response:', JSON.stringify(data).slice(0, 500))
    const src = ((data as Record<string, unknown>).observations ?? data.data ?? data) as Record<string, unknown>

    const invocations = src.invocations as { total?: number; used?: number; limit?: number } | undefined
    if (invocations) {
      metrics.push({
        key: 'vercel_invocations',
        label: 'Invocaciones',
        used: invocations.total ?? invocations.used ?? 0,
        limit: invocations.limit ?? 0,
        unit: 'requests',
      })
    }

    const duration = src.duration as { total?: number; used?: number; limit?: number } | undefined
    if (duration) {
      metrics.push({
        key: 'vercel_duration',
        label: 'Tiempo ejecución',
        used: Math.round((duration.total ?? duration.used ?? 0) / 3600),
        limit: Math.round((duration.limit ?? 0) / 3600),
        unit: 'hours',
      })
    }

    const bandwidth = src.bandwidth as { total?: number; used?: number; limit?: number } | undefined
    if (bandwidth) {
      metrics.push({
        key: 'vercel_bandwidth',
        label: 'Ancho de banda',
        used: Math.round((bandwidth.total ?? bandwidth.used ?? 0) / 1073741824 * 100) / 100,
        limit: Math.round((bandwidth.limit ?? 0) / 1073741824 * 100) / 100,
        unit: 'GB',
      })
    }
  } catch (e) {
    console.warn('[monitoring] Vercel Observations API failed:', e instanceof Error ? e.message : e)
  }

  // If no metrics yet, try without teamId (personal accounts)
  if (metrics.length === 0 && teamId) {
    try {
      const data = await vercelApi(config.token, '/v1/observations/usage') as Record<string, unknown>
      const src = ((data as Record<string, unknown>).observations ?? data.data ?? data) as Record<string, unknown>
      const inv = src.invocations as { total?: number; used?: number; limit?: number } | undefined
      if (inv) { metrics.push({ key: 'vercel_invocations', label: 'Invocaciones', used: inv.total ?? inv.used ?? 0, limit: inv.limit ?? 0, unit: 'requests' }) }
    } catch { /* ignore */ }
  }

  return metrics
}

export const vercelProvider: MonitoringProvider = { definition: DEFINITION, validate, fetchUsage }
