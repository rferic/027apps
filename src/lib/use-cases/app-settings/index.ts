import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(func: string, params: Record<string, unknown>): Promise<any> {
  const supabase = createAdminClient()
  return (supabase.rpc as any)(func, params)
}

export async function getAppSetting(key: string): Promise<unknown | null> {
  const { data, error } = await rpc('get_app_setting', { p_key: key })
  if (error) throw new Error(`Failed to read app setting "${key}": ${error.message}`)
  return data ?? null
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  const { error } = await rpc('set_app_setting', {
    p_key: key,
    p_value: JSON.parse(JSON.stringify(value)),
  })
  if (error) throw new Error(`Failed to save app setting "${key}": ${error.message}`)
}

export async function deleteAppSetting(key: string): Promise<void> {
  const { error } = await rpc('delete_app_setting', { p_key: key })
  if (error) throw new Error(`Failed to delete app setting "${key}": ${error.message}`)
}

export async function getAllAppSettings(): Promise<Record<string, unknown>> {
  const { data } = await rpc('get_all_app_settings', {})
  const rows = (data ?? []) as Array<{ key: string; value: unknown }>
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}
