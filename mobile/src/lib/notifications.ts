import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9B1C1C',
    })
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Must use physical device for push notifications')
    return false
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Permission not granted for push notifications')
    return false
  }

  return true
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return token.data
  } catch (error) {
    console.error('Failed to get push token:', error)
    return null
  }
}

export async function registerPushToken(token: string, apiBaseUrl: string): Promise<boolean> {
  try {
    const { getAccessToken } = await import('@/lib/token-store')
    const accessToken = await getAccessToken()
    if (!accessToken) return false

    const res = await fetch(`${apiBaseUrl}/api/v1/mobile/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    })

    return res.status === 204
  } catch (error) {
    console.error('Failed to register push token:', error)
    return false
  }
}

export type NotificationData = {
  type?: string
  requestId?: string
  [key: string]: unknown
}

export type ReceivedNotification = {
  title: string | null
  body: string | null
  data: NotificationData
}
