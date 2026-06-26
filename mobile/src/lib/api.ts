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

export async function getApiClient() {
  if (!_client) {
    _client = await createApiClient()
  }
  return _client
}

export function invalidateApiClient() {
  _client = null
}
