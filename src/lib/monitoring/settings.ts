import { createAdminClient } from '@/lib/supabase/admin'

const STORAGE_KEY = 'monitoring'

async function getAppConfig(): Promise<Record<string, unknown>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('installed_apps')
    .select('config')
    .eq('slug', 'inspiration')
    .maybeSingle()
  return (data?.config as Record<string, unknown>) ?? {}
}

async function saveAppConfig(config: Record<string, unknown>): Promise<void> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from('installed_apps')
    .update({ config: config as any })
    .eq('slug', 'inspiration')
  if (error) throw new Error(`Failed to save monitoring settings: ${error.message}`)
}

export async function getMonitoringSetting(key: string): Promise<string | null> {
  const config = await getAppConfig()
  const monitoring = (config[STORAGE_KEY] as Record<string, string>) ?? {}
  return monitoring[key] ?? null
}

export async function setMonitoringSetting(key: string, value: string): Promise<void> {
  const config = await getAppConfig()
  const monitoring = (config[STORAGE_KEY] as Record<string, string>) ?? {}
  monitoring[key] = value
  config[STORAGE_KEY] = monitoring
  await saveAppConfig(config)
}

export async function deleteMonitoringSetting(key: string): Promise<void> {
  const config = await getAppConfig()
  const monitoring = (config[STORAGE_KEY] as Record<string, string>) ?? {}
  delete monitoring[key]
  config[STORAGE_KEY] = monitoring
  await saveAppConfig(config)
}
