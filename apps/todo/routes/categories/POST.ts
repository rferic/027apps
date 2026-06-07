import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, _ctx: HandlerContext) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return apiError('VALIDATION_ERROR', 'Name is required', 400)

  const emoji = typeof body.emoji === 'string' ? body.emoji : '📌'
  const color = typeof body.color === 'string' ? body.color : '#6B7280'

  const db = createAdminClientUntyped()
  const { data, error } = await db.from('todo_categories').insert({ name, emoji, color }).select().single()
  if (error) return apiError('CREATE_FAILED', error.message, 500)

  return apiOk(data)
}
