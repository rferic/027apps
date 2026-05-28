import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

const LocaleSchema = z.object({
  code: z.string().describe('Locale code (e.g. en, es, ca)'),
  name: z.string().describe('Locale display name'),
  is_default: z.boolean().describe('Whether this is the default locale'),
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
