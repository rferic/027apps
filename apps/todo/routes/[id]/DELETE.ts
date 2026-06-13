import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyStatusChange, notifyGroupStatusChange } from '@/lib/use-cases/todo/notifications'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing item ID', 400)

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('todo_items').select('*').eq('id', id).single()
  if (!existing) return apiError('NOT_FOUND', 'Item not found', 404)

  const deleteSeries = url.searchParams.get('delete_series') === 'true'

  if (deleteSeries) {
    const { data: item } = await db.from('todo_items').select('title, group_id, due_date').eq('id', id).single()
    if (!item) return apiError('NOT_FOUND', 'Item not found', 404)
    const { error } = await db.from('todo_items')
      .delete()
      .eq('title', item.title)
      .eq('group_id', ctx.groupId)
      .gte('due_date', item.due_date ?? new Date().toISOString().slice(0, 10))
    if (error) return apiError('DELETE_FAILED', error.message, 500)
  } else {
    const { error } = await db.from('todo_items')
      .delete()
      .eq('id', id)
      .eq('group_id', ctx.groupId)
    if (error) return apiError('DELETE_FAILED', error.message, 500)
  }

  // Notify (best-effort)
  const reqUserId = ctx.userId
  const groupSlug = url.pathname.split('/')[4] ?? ''
  if (existing.visibility === 'public') {
    void notifyGroupStatusChange(id, existing.title as string, ctx.groupId, existing.status as string, 'deleted', groupSlug, groupSlug, reqUserId)
  } else if (existing.visibility === 'private' && existing.created_by && existing.created_by !== reqUserId) {
    void notifyStatusChange(id, existing.title as string, existing.created_by as string, existing.status as string, 'deleted', groupSlug, groupSlug)
  }

  return new Response(null, { status: 204 })
}