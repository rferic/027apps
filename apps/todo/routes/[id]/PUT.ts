import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyAssigned, notifyStatusChange } from '@/lib/use-cases/todo/notifications'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing item ID', 400)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('todo_items').select('*').eq('id', id).single()
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
  if (body.assigned_to !== undefined) {
    if (body.assigned_to === 'self') {
      const auth = await db.auth.getUser()
      if (auth.data?.user) update.assigned_to = auth.data.user.id
    } else {
      update.assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to : null
    }
  }
  if (body.due_date !== undefined) update.due_date = typeof body.due_date === 'string' ? body.due_date : null

  const { data: item, error } = await db.from('todo_items').update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  // Fire notifications (best-effort, don't block response)
  const urlSegments = new URL(req.url).pathname.split('/')
  const groupSlug = urlSegments[4] ?? ''
  if (update.assigned_to && update.assigned_to !== existing.assigned_to) {
    void notifyAssigned(id, item.title as string, update.assigned_to as string, 'Someone', groupSlug, groupSlug)
  }
  if (update.status && update.status !== existing.status && existing.assigned_to) {
    void notifyStatusChange(id, item.title as string, existing.assigned_to as string, existing.status as string, update.status as string, groupSlug, groupSlug)
  }

  return apiOk(item)
}
