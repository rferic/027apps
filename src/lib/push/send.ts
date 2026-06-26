import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { shouldNotify } from './prefs'
import type { NotificationType, PushPayload } from './types'

let expo: Expo | null = null

function getExpo(): Expo {
  if (!expo) expo = new Expo()
  return expo
}

interface PushTokenRow {
  user_id: string
  token: string
}

export async function sendPushNotifications(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (userIds.length === 0) return

  const db = createAdminClientUntyped()

  const { data: tokens } = await db
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds)

  if (!tokens || tokens.length === 0) return

  const messages: ExpoPushMessage[] = []

  for (const raw of tokens) {
    const row = raw as PushTokenRow
    if (!Expo.isExpoPushToken(row.token)) continue

    const allowed = await shouldNotify(row.user_id, payload.type)
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
