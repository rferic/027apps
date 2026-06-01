import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, AuthHeadersSchema } from '../common'

const c = initContract()

const AppSchema = z.object({
  slug: z.string().describe('Unique app identifier'),
  name: z.string().describe('App display name'),
  description: z.string().nullable().describe('App description'),
  icon_url: z.string().nullable().describe('App icon URL'),
  status: z.string().describe('App status: active, inactive'),
  visibility: z.string().describe('App visibility: public, private'),
})

export const appsContract = c.router({
  listApps: {
    method: 'GET',
    path: '/api/v1/apps',
    summary: 'List installed apps',
    description: 'Returns all active installed apps for the authenticated group. Authenticate with JWT or API key.',
    responses: {
      200: z.array(AppSchema),
      401: ErrorResponseSchema,
    },
    headers: AuthHeadersSchema,
  },
})
