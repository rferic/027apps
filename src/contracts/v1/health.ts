import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

const HealthResponseSchema = z.object({
  version: z.literal('v1'),
  status: z.literal('ok'),
})

export const healthContract = c.router({
  getHealth: {
    method: 'GET',
    path: '/api/v1',
    responses: {
      200: HealthResponseSchema,
    },
  },
})
