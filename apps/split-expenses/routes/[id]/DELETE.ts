import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', id).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: existing } = await db.from('split_expenses_groups')
    .select('id').eq('id', id).eq('group_id', ctx.groupId).single()
  if (!existing) return apiError('NOT_FOUND', 'Expense group not found', 404)

  const { error } = await db.from('split_expenses_groups').delete().eq('id', id)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
