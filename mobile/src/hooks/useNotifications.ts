import { useState, useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import {
  setupNotificationChannel,
  requestNotificationPermissions,
  getExpoPushToken,
  registerPushToken,
} from '@/lib/notifications'
import type { ReceivedNotification } from '@/lib/notifications'
import { getServerUrl, getDefaultUrl } from '@/lib/server-url'

export function useNotifications() {
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [pushToken, setPushToken] = useState<string | null>(null)
  const [lastNotification, setLastNotification] = useState<ReceivedNotification | null>(null)
  const [isReady, setIsReady] = useState(false)
  const initialized = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      await setupNotificationChannel()

      const granted = await requestNotificationPermissions()
      setPermissionGranted(granted)

      if (granted) {
        const token = await getExpoPushToken()
        setPushToken(token)

        if (token) {
          const baseUrl = (await getServerUrl()) || getDefaultUrl()
          await registerPushToken(token, baseUrl)
        }
      }

      setIsReady(true)
    }

    init()
  }, [])

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const notif: ReceivedNotification = {
        title: notification.request.content.title ?? null,
        body: notification.request.content.body ?? null,
        data: (notification.request.content.data ?? {}) as ReceivedNotification['data'],
      }
      setLastNotification(notif)
    })

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined
      if (!data) return
      const type = data.type as string | undefined
      const requestId = data.requestId as string | undefined
      const todoId = data.todoId as string | undefined
      const expenseGroupId = data.expenseGroupId as string | undefined

      if (requestId && type?.startsWith('inspiration')) {
        router.push(`/(app)/modules/inspiration/${requestId}`)
      } else if (todoId && type?.startsWith('todo')) {
        router.push(`/(app)/modules/todo/${todoId}`)
      } else if (expenseGroupId && type?.startsWith('expenses')) {
        router.push(`/(app)/modules/split-expenses/${expenseGroupId}`)
      }
    })

    return () => {
      receivedSubscription.remove()
      responseSubscription.remove()
    }
  }, [router])

  return { permissionGranted, pushToken, lastNotification, isReady }
}
