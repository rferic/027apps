import * as SecureStore from 'expo-secure-store'

const SERVER_URL_KEY = '027apps_server_url'
const DEFAULT_URL = 'https://027apps.com'

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

export function getDefaultUrl(): string {
  return DEFAULT_URL
}
