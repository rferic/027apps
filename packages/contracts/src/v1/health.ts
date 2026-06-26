import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

const HealthResponseSchema = z.object({
  version: z.literal('v1').describe('API version'),
  status: z.literal('ok').describe('Service status'),
})

export const healthContract = c.router({
  getHealth: {
    method: 'GET',
    path: '/api/v1',
    summary: 'Health check',
    description: 'Returns the API version and status. No authentication required.',
    responses: {
      200: HealthResponseSchema,
    },
  },
})
