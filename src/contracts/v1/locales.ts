import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

const LocaleSchema = z.object({
  code: z.string(),
  name: z.string(),
  is_default: z.boolean(),
})

export const localesContract = c.router({
  getLocales: {
    method: 'GET',
    path: '/api/v1/locales',
    summary: 'List active locales',
    description: 'Returns the active locales configured for the group, with their display names and default flag.',
    responses: {
      200: z.array(LocaleSchema),
    },
  },
})
