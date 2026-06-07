import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, _ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing category ID', 400)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') update.name = body.name.trim()
  if (typeof body.emoji === 'string') update.emoji = body.emoji
  if (typeof body.color === 'string') update.color = body.color

  const db = createAdminClientUntyped()
  const { data, error } = await db.from('todo_categories').update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  return apiOk(data)
}
