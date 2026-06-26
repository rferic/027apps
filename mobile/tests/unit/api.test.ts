import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/server-url', () => ({
  getServerUrl: vi.fn(() => Promise.resolve('https://test.example.com')),
  getDefaultUrl: vi.fn(() => 'https://027apps.com'),
}))

vi.mock('@/lib/token-store', () => ({
  getAccessToken: vi.fn(() => Promise.resolve('test-token-123')),
}))

vi.mock('@ts-rest/core', () => ({
  initClient: vi.fn((contract: unknown, args: { baseUrl: string; baseHeaders: Record<string, string> }) => ({
    contract,
    ...args,
  })),
}))

vi.mock('@027apps/contracts', () => ({
  apiContract: { mock: true },
}))

import { createApiClient, getApiClient, invalidateApiClient } from '@/lib/api'
import { initClient } from '@ts-rest/core'

describe('createApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should construct URL from getServerUrl when available', async () => {
    const client = await createApiClient()
    expect((client as unknown as { baseUrl: string }).baseUrl).toBe('https://test.example.com')
  })

  it('should add Authorization header when token is available', async () => {
    const client = await createApiClient()
    const headers = (client as unknown as { baseHeaders: Record<string, string> }).baseHeaders
    expect(headers.Authorization).toBe('Bearer test-token-123')
  })

  it('should not add Authorization header when token is null', async () => {
    const { getAccessToken } = await import('@/lib/token-store')
    vi.mocked(getAccessToken).mockResolvedValue(null)

    const client = await createApiClient()
    const headers = (client as unknown as { baseHeaders: Record<string, string> }).baseHeaders
    expect(headers.Authorization).toBeUndefined()
  })

  it('should fallback to default URL when no server URL is stored', async () => {
    const { getServerUrl } = await import('@/lib/server-url')
    vi.mocked(getServerUrl).mockResolvedValue('')

    const client = await createApiClient()
    expect((client as unknown as { baseUrl: string }).baseUrl).toBe('https://027apps.com')
  })
})

describe('getApiClient', () => {
  it('should reuse the same client instance', async () => {
    invalidateApiClient()
    const client1 = await getApiClient()
    const client2 = await getApiClient()
    expect(client1).toBe(client2)
  })
})

describe('invalidateApiClient', () => {
  it('should reset the singleton', async () => {
    const client1 = await getApiClient()
    invalidateApiClient()
    const client2 = await getApiClient()
    expect(client1).not.toBe(client2)
  })
})
