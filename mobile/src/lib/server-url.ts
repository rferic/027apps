import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const SERVER_URL_KEY = '027apps_server_url'

export function getDefaultUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined
  return (extra?.defaultApiUrl as string) ?? 'https://027apps.com'
}

export async function getServerUrl(): Promise<string> {
  const url = await SecureStore.getItemAsync(SERVER_URL_KEY)
  return url || ''
}

export async function setServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url)
}

export async function hasServerUrl(): Promise<boolean> {
  const url = await SecureStore.getItemAsync(SERVER_URL_KEY)
  return url !== null && url.length > 0
}
