import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return apiError('VALIDATION_ERROR', 'Title is required', 400)

  const description = typeof body.description === 'string' ? body.description : ''
  const visibility = body.visibility === 'private' ? 'private' : 'public'
  const priority = ['low', 'medium', 'high', 'urgent'].includes(body.priority as string) ? body.priority : 'medium'
  const categoryId = typeof body.category_id === 'string' ? body.category_id : null
  const dueDate = typeof body.due_date === 'string' ? body.due_date : null
  const assignedTo = visibility === 'public' && typeof body.assigned_to === 'string' ? body.assigned_to : null
  const repeatInterval = ['weekly', 'monthly', 'yearly'].includes(body.repeat_interval as string) ? body.repeat_interval as string : null
  const repeatEndDate = typeof body.repeat_end_date === 'string' ? body.repeat_end_date : null

  const db = createAdminClientUntyped()

  const { data: item, error } = await db.from('todo_items').insert({
    group_id: ctx.groupId,
    title,
    description: description || null,
    visibility,
    status: 'pending',
    priority,
    category_id: categoryId,
    assigned_to: assignedTo,
    created_by: ctx.userId,
    due_date: dueDate,
    repeat_interval: repeatInterval,
    repeat_end_date: repeatEndDate,
  }).select().single()

  if (error) return apiError('CREATE_FAILED', error.message, 500)

  return apiOk(item)
}
