import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, UnauthorizedResponseSchema, ForbiddenResponseSchema } from '../common'

const c = initContract()

const MeResponseSchema = z.object({
  id: z.string().describe('User UUID'),
  email: z.string().describe('User email address'),
  display_name: z.string().nullable().describe('Display name'),
  avatar_url: z.string().nullable().describe('Avatar URL'),
  locale: z.string().nullable().describe('Preferred locale code'),
  role: z.string().describe('User role: admin or member'),
  group_id: z.string().describe('Primary group UUID'),
})

export const meContract = c.router({
  getMe: {
    method: 'GET',
    path: '/api/v1/me',
    summary: 'Get current user profile',
    description: 'Returns the authenticated user\'s profile information including display name, avatar, locale, role, and group membership.',
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
