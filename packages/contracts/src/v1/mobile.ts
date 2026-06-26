import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../common'

const c = initContract()

const PushTokenSchema = z.object({
  token: z.string().describe('Expo push token'),
  platform: z.enum(['ios', 'android']).describe('Device platform'),
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
