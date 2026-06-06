import { createAdminClient } from '@/lib/supabase/admin'

type Supabase = ReturnType<typeof createAdminClient>

function db(supabase: Supabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from('app_settings' as any) as any
}

export async function getAppSetting(key: string): Promise<unknown | null> {
  const supabase = createAdminClient()
  const { data } = await db(supabase).select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  const supabase = createAdminClient()
  await db(supabase).upsert(
    { key, value: JSON.parse(JSON.stringify(value)), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export async function deleteAppSetting(key: string): Promise<void> {
  const supabase = createAdminClient()
  await db(supabase).delete().eq('key', key)
}

export async function getAllAppSettings(): Promise<Record<string, unknown>> {
  const supabase = createAdminClient()
  const { data } = await db(supabase).select('key, value')
  const result: Record<string, unknown> = {}
  if (data) {
    for (const row of data as Array<{ key: string; value: unknown }>) {
      result[row.key] = row.value
    }
  }
  return result
}
