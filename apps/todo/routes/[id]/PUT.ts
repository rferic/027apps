import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing item ID', 400)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('todo_items').select('id').eq('id', id).single()
  if (!existing) return apiError('NOT_FOUND', 'Item not found', 404)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.title === 'string') update.title = body.title.trim()
  if (body.description !== undefined) update.description = typeof body.description === 'string' ? body.description : null
  if (body.visibility === 'public' || body.visibility === 'private') update.visibility = body.visibility
  if (['pending', 'in_progress', 'done', 'cancelled'].includes(body.status as string)) {
    update.status = body.status
    if (body.status === 'done') update.completed_at = new Date().toISOString()
  }
  if (['low', 'medium', 'high', 'urgent'].includes(body.priority as string)) update.priority = body.priority
  if (body.category_id !== undefined) update.category_id = typeof body.category_id === 'string' ? body.category_id : null
  if (body.assigned_to !== undefined) update.assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to : null
  if (body.due_date !== undefined) update.due_date = typeof body.due_date === 'string' ? body.due_date : null

  const { data: item, error } = await db.from('todo_items').update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  return apiOk(item)
}
