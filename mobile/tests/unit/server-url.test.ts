import { describe, it, expect, vi, beforeEach } from 'vitest'

// The module under test uses expo-secure-store which is mocked in setup.ts
import { getServerUrl, setServerUrl, hasServerUrl, getDefaultUrl } from '@/lib/server-url'
import * as SecureStore from 'expo-secure-store'

const SERVER_URL_KEY = '027apps_server_url'

describe('getServerUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset SecureStore mock state
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
  })

  it('should return the stored URL', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('https://my-server.com')
    const url = await getServerUrl()
    expect(url).toBe('https://my-server.com')
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(SERVER_URL_KEY)
  })

  it('should return empty string when no URL is stored', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
    const url = await getServerUrl()
    expect(url).toBe('')
  })
})

describe('setServerUrl', () => {
  it('should save the URL to SecureStore', async () => {
    await setServerUrl('https://custom.example.com')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SERVER_URL_KEY, 'https://custom.example.com')
  })
})

describe('hasServerUrl', () => {
  it('should return true when URL is stored', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('https://server.com')
    const result = await hasServerUrl()
    expect(result).toBe(true)
  })

  it('should return false when URL is null', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
    const result = await hasServerUrl()
    expect(result).toBe(false)
  })

  it('should return false when URL is empty string', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('')
    const result = await hasServerUrl()
    expect(result).toBe(false)
  })
})

describe('getDefaultUrl', () => {
  it('should return the default URL', () => {
    expect(getDefaultUrl()).toBe('https://027apps.com')
  })
})
