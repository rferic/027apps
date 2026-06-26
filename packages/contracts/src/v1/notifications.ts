import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

const NotificationPrefsSchema = z.object({
  global_enabled: z.boolean(),
  types: z.record(z.boolean()),
  all_types: z.array(z.string()),
})

const UpdatePrefsBodySchema = z.object({
  global_enabled: z.boolean().optional(),
  types: z.record(z.boolean()).optional(),
})

export const notificationsContract = c.router({
  getPrefs: {
    method: 'GET',
    path: '/api/v1/notifications/prefs',
    summary: 'Get notification preferences',
    responses: {
      200: NotificationPrefsSchema,
    },
  },
  updatePrefs: {
    method: 'PUT',
    path: '/api/v1/notifications/prefs',
    summary: 'Update notification preferences',
    body: UpdatePrefsBodySchema,
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
})
