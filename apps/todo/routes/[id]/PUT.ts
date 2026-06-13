import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyAssigned, notifyStatusChange, notifyGroupStatusChange } from '@/lib/use-cases/todo/notifications'
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
  if (['weekly', 'monthly', 'yearly'].includes(body.repeat_interval as string)) update.repeat_interval = body.repeat_interval
  if (body.repeat_interval === null) update.repeat_interval = null
  if (body.repeat_end_date !== undefined) update.repeat_end_date = typeof body.repeat_end_date === 'string' ? body.repeat_end_date : null

  const { data: item, error } = await db.from('todo_items').update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  // Create recurrence copy if marked as done AND has repeat_interval
  if (update.status === 'done' && existing.repeat_interval) {
    const dueDate = new Date(existing.due_date ?? new Date())
    let nextDue: Date | null = null
    switch (existing.repeat_interval) {
      case 'weekly': nextDue = new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000); break
      case 'monthly': nextDue = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, dueDate.getDate()); break
      case 'yearly': nextDue = new Date(dueDate.getFullYear() + 1, dueDate.getMonth(), dueDate.getDate()); break
    }
    if (nextDue && (!existing.repeat_end_date || nextDue <= new Date(existing.repeat_end_date))) {
      await db.from('todo_items').insert({
        group_id: existing.group_id,
        title: existing.title,
        description: existing.description,
        visibility: existing.visibility,
        status: 'pending',
        priority: existing.priority,
        category_id: existing.category_id,
        assigned_to: existing.assigned_to,
        created_by: existing.created_by,
        due_date: nextDue.toISOString(),
        repeat_interval: existing.repeat_interval,
        repeat_end_date: existing.repeat_end_date,
      })
    }
  }

  // Fire notifications (best-effort, don't block response)
  const urlSegments = new URL(req.url).pathname.split('/')
  const groupSlug = urlSegments[4] ?? ''
  const reqUserId = ctx.userId

  if (update.assigned_to && update.assigned_to !== existing.assigned_to && update.assigned_to !== reqUserId) {
    void notifyAssigned(id, item.title as string, update.assigned_to as string, 'Someone', groupSlug, groupSlug)
  }
  if (update.status && update.status !== existing.status) {
    if (existing.visibility === 'public') {
      void notifyGroupStatusChange(id, item.title as string, existing.group_id as string, existing.status as string, update.status as string, groupSlug, groupSlug, reqUserId)
    } else if (existing.visibility === 'private' && existing.created_by && existing.created_by !== reqUserId) {
      void notifyStatusChange(id, item.title as string, existing.created_by as string, existing.status as string, update.status as string, groupSlug, groupSlug)
    }
  }

  return apiOk(item)
}
