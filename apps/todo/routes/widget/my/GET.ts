import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(_req: Request, ctx: HandlerContext) {
  if (!ctx.userId) return apiError('UNAUTHORIZED', 'Authentication required', 401)

  const db = createAdminClientUntyped()

  // My tasks: assigned to me, not done
  const { data, error } = await db.from('todo_items')
    .select('id, title, priority, due_date, status, category_id')
    .eq('group_id', ctx.groupId)
    .eq('assigned_to', ctx.userId)
    .neq('status', 'done')
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true })
    .limit(5)

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  return apiOk(data ?? [])
}
