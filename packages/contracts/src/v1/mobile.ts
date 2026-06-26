import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../common'

const c = initContract()

const PushTokenSchema = z.object({
  token: z.string().describe('Expo push token'),
  platform: z.enum(['ios', 'android']).describe('Device platform'),
})

const VersionResponseSchema = z.object({
  latest_version: z.string().describe('Latest available version (semver)'),
  min_version: z.string().describe('Minimum required version (semver)'),
  download_url: z.string().describe('URL to download the latest APK'),
  release_notes: z.string().nullable().describe('Release notes'),
})

export const versionContract = c.router({
  getVersion: {
    method: 'GET',
    path: '/api/v1/mobile/version',
    summary: 'Get latest mobile app version',
    responses: {
      200: VersionResponseSchema,
    },
  },
})

export const mobileContract = c.router({
  registerPushToken: {
    method: 'POST',
    path: '/api/v1/mobile/push-token',
    summary: 'Register a push notification token',
    description: 'Stores the Expo push token for the authenticated user to receive push notifications.',
    body: PushTokenSchema,
    responses: {
      204: c.noBody(),
      401: UnauthorizedResponseSchema,
      403: ForbiddenResponseSchema,
    },
    headers: z.object({
      authorization: z.string().startsWith('Bearer '),
    }),
  },
})
