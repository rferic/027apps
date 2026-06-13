import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const expenseId = new URL(req.url).pathname.split('/').pop()

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('split_expenses_expenses')
    .select('id, settled').eq('id', expenseId).single()
  if (!existing) return apiError('NOT_FOUND', 'Expense not found', 404)
  if (existing.settled) return apiError('CONFLICT', 'Cannot delete a settled expense', 409)

  const { error } = await db.from('split_expenses_expenses').delete().eq('id', expenseId)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
