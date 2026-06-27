import { initClient } from '@ts-rest/core'
import type { InitClientReturn, InitClientArgs } from '@ts-rest/core'
import { apiContract } from '@027apps/contracts'
import { getServerUrl, getDefaultUrl } from './server-url'
import { getAccessToken } from './token-store'

export async function createApiClient() {
  const baseUrl = (await getServerUrl()) || getDefaultUrl()
  const token = await getAccessToken()

  return initClient(apiContract, {
    baseUrl,
    baseHeaders: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  })
}

let _client: InitClientReturn<typeof apiContract, InitClientArgs> | null = null
let _clientPromise: ReturnType<typeof createApiClient> | null = null
let _lastBaseUrl: string | null = null

export async function getApiClient() {
  const baseUrl = (await getServerUrl()) || getDefaultUrl()

  // Invalidate if URL changed
  if (_lastBaseUrl && _lastBaseUrl !== baseUrl) {
    invalidateApiClient()
  }

  if (_client) return _client

  // Ensure only one client creation at a time
  if (!_clientPromise) {
    _lastBaseUrl = baseUrl
    _clientPromise = createApiClient()
      .then((client) => {
        _client = client
        _clientPromise = null
        return client
      })
      .catch((err) => {
        _clientPromise = null
        throw err
      })
  }

  return _clientPromise
}

export function invalidateApiClient() {
  _client = null
  _clientPromise = null
}
