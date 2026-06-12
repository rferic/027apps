import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing item ID', 400)

  const db = createAdminClientUntyped()
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

  return new Response(null, { status: 204 })
}