import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../common'

const c = initContract()

const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  locale: z.string().nullable(),
  role: z.string(),
  group_id: z.string(),
})

export const meContract = c.router({
  getMe: {
    method: 'GET',
    path: '/api/v1/me',
    responses: {
      200: MeResponseSchema,
      401: UnauthorizedResponseSchema,
      403: ForbiddenResponseSchema,
    },
    headers: z.object({
      authorization: z.string().startsWith('Bearer '),
    }),
  },
})
