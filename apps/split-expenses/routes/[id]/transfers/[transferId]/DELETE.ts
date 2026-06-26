import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const transferId = url.pathname.split('/').pop()
  const expenseGroupId = url.pathname.split('/').at(-3)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: existing } = await db.from('split_expenses_transfers')
    .select('id, settlement_id, is_manual').eq('id', transferId).single()
  if (!existing) return apiError('NOT_FOUND', 'Transfer not found', 404)
  if (existing.settlement_id) return apiError('CONFLICT', 'Cannot delete a transfer from a settlement', 409)

  const { error } = await db.from('split_expenses_transfers').delete().eq('id', transferId)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
