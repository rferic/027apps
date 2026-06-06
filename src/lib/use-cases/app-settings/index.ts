import { createAdminClient } from '@/lib/supabase/admin'

const GITHUB_CONFIG_KEY = 'github'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getInspirationApp(): Promise<any> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('installed_apps')
    .select('config')
    .eq('slug', 'inspiration')
    .maybeSingle()
  if (error) throw new Error(`Failed to read inspiration app config: ${error.message}`)
  return data
}

export async function getAppSetting(key: string): Promise<unknown | null> {
  if (!key.startsWith('github_')) return null

  const app = await getInspirationApp()
  const config = (app?.config as Record<string, unknown>) ?? {}
  const githubConfig = (config[GITHUB_CONFIG_KEY] as Record<string, unknown>) ?? {}
  const settingKey = key.replace('github_', '')
  return githubConfig[settingKey] ?? null
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  if (!key.startsWith('github_')) return

  const supabase = createAdminClient()
  const app = await getInspirationApp()
  const config = (app?.config as Record<string, unknown>) ?? {}
  const githubConfig = (config[GITHUB_CONFIG_KEY] as Record<string, unknown>) ?? {}
  const settingKey = key.replace('github_', '')

  githubConfig[settingKey] = JSON.parse(JSON.stringify(value))
  config[GITHUB_CONFIG_KEY] = githubConfig

  const { error } = await supabase
    .from('installed_apps')
    .update({ config: config as any })
    .eq('slug', 'inspiration')

  if (error) throw new Error(`Failed to save app setting "${key}": ${error.message}`)
}

export async function deleteAppSetting(key: string): Promise<void> {
  if (!key.startsWith('github_')) return

  const supabase = createAdminClient()
  const app = await getInspirationApp()
  const config = (app?.config as Record<string, unknown>) ?? {}
  const githubConfig = (config[GITHUB_CONFIG_KEY] as Record<string, unknown>) ?? {}
  const settingKey = key.replace('github_', '')

  delete githubConfig[settingKey]
  config[GITHUB_CONFIG_KEY] = githubConfig

  const { error } = await supabase
    .from('installed_apps')
    .update({ config: config as any })
    .eq('slug', 'inspiration')

  if (error) throw new Error(`Failed to delete app setting "${key}": ${error.message}`)
}
