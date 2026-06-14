'use server'

import { getMonitoringSetting, setMonitoringSetting, deleteMonitoringSetting } from '@/lib/monitoring/settings'
import { getProvider } from '@/lib/monitoring'

export async function testConnectionAction(providerId: string, config: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const provider = getProvider(providerId)
  if (!provider) return { ok: false, error: `Provider "${providerId}" not found` }
  const result = await provider.validate(config)
  return { ok: result.valid, error: result.error }
}

export async function saveProviderConfigAction(providerId: string, config: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  try {
    for (const [key, value] of Object.entries(config)) {
      await setMonitoringSetting(`${providerId}_${key}`, value)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to save' }
  }
}

export async function disconnectProviderAction(providerId: string): Promise<{ ok: boolean }> {
  const provider = getProvider(providerId)
  if (!provider) return { ok: false }
  for (const field of provider.definition.fields) {
    await deleteMonitoringSetting(`${providerId}_${field.key}`)
  }
  return { ok: true }
}

export async function getProviderConfigAction(providerId: string): Promise<Record<string, string>> {
  const provider = getProvider(providerId)
  if (!provider) return {}
  const config: Record<string, string> = {}
  for (const field of provider.definition.fields) {
    const value = await getMonitoringSetting(`${providerId}_${field.key}`)
    if (value) config[field.key] = value
  }
  return config
}
