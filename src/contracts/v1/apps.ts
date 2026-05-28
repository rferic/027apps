import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema } from '../common'

const c = initContract()

const AppSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon_url: z.string().nullable(),
  status: z.string(),
  visibility: z.string(),
})

export const appsContract = c.router({
  listApps: {
    method: 'GET',
    path: '/api/v1/apps',
    responses: {
      200: z.array(AppSchema),
      401: ErrorResponseSchema,
    },
    headers: z.object({
      authorization: z.string().optional(),
      'x-api-key': z.string().optional(),
    }),
  },
})
