import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { NotificationType } from './types'

interface NotificationPrefs {
  global_enabled: boolean
  types: Partial<Record<NotificationType, boolean>>
}

const DEFAULTS: NotificationPrefs = {
  global_enabled: true,
  types: {},
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const db = createAdminClientUntyped()
  const { data } = await db
    .from('notification_prefs')
    .select('global_enabled, prefs')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return DEFAULTS

  const row = data as { global_enabled?: boolean; prefs?: Record<string, boolean> }
  return {
    global_enabled: row.global_enabled ?? true,
    types: row.prefs ?? {},
  }
}

export async function shouldNotify(userId: string, type: NotificationType): Promise<boolean> {
  const prefs = await getNotificationPrefs(userId)
  if (!prefs.global_enabled) return false

  const typePref = prefs.types[type]
  if (typePref === false) return false

  return true
}
