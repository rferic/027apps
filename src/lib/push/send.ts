import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { isPushEnabled } from '@/lib/settings/notifications'
import type { NotificationType, PushPayload } from './types'

let expo: Expo | null = null

function getExpo(): Expo {
  if (!expo) expo = new Expo()
  return expo
}

let pushEnabledCache: { value: boolean; ts: number } | null = null

async function shouldSendPush(): Promise<boolean> {
  if (pushEnabledCache && Date.now() - pushEnabledCache.ts < 30000) {
    return pushEnabledCache.value
  }
  const value = await isPushEnabled()
  pushEnabledCache = { value, ts: Date.now() }
  return value
}

interface PushTokenRow {
  user_id: string
  token: string
}

export async function sendPushNotifications(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  const enabled = await shouldSendPush()
  if (!enabled) {
    console.log(`[Push] Disabled globally — skipping: "${payload.title}"`)
    return
  }

  if (userIds.length === 0) return

  const db = createAdminClientUntyped()

  const { data: tokens } = await db
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds)

  if (!tokens || tokens.length === 0) return

  const uniqueUserIds = [...new Set((tokens as PushTokenRow[]).map((r) => r.user_id))]
  const prefsMap = new Map<string, boolean>()
  const { data: allPrefs } = await db
    .from('notification_prefs')
    .select('user_id, global_enabled, prefs')
    .in('user_id', uniqueUserIds)

  for (const pref of (allPrefs ?? [])) {
    const p = pref as { user_id: string; global_enabled: boolean; prefs: Record<string, boolean> }
    if (!p.global_enabled) { prefsMap.set(p.user_id, false); continue }
    const typeVal = p.prefs?.[payload.type]
    prefsMap.set(p.user_id, typeVal !== false)
  }

  const messages: ExpoPushMessage[] = []

  for (const raw of tokens) {
    const row = raw as PushTokenRow
    if (!Expo.isExpoPushToken(row.token)) continue

    const allowed = prefsMap.get(row.user_id) ?? true
    if (!allowed) continue

    messages.push({
      to: row.token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        ...payload.data,
      },
    })
  }

  if (messages.length === 0) return

  const expoInstance = getExpo()
  const chunks = expoInstance.chunkPushNotifications(messages)

  for (const chunk of chunks) {
    try {
      await expoInstance.sendPushNotificationsAsync(chunk)
    } catch (error) {
      console.error(`[Push] Failed to send chunk:`, error)
    }
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  return sendPushNotifications([userId], payload)
}
