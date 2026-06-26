import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const transferId = url.pathname.split('/').pop()
  const expenseGroupId = url.pathname.split('/').at(-3)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: existing } = await db.from('split_expenses_transfers')
    .select('*').eq('id', transferId).single()
  if (!existing) return apiError('NOT_FOUND', 'Transfer not found', 404)
  if (existing.settlement_id) return apiError('CONFLICT', 'Cannot edit a transfer from a settlement', 409)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.from_user !== undefined) {
    if (typeof body.from_user !== 'string') return apiError('BAD_REQUEST', 'from_user must be a string', 400)
    update.from_user = body.from_user
  }
  if (body.to_user !== undefined) {
    if (typeof body.to_user !== 'string') return apiError('BAD_REQUEST', 'to_user must be a string', 400)
    update.to_user = body.to_user
  }
  if (body.amount !== undefined) {
    const amount = parseFloat(body.amount as string)
    if (isNaN(amount) || amount <= 0) return apiError('BAD_REQUEST', 'amount must be greater than 0', 400)
    update.amount = amount
  }
  if (body.note !== undefined) {
    update.note = body.note || null
  }
  if (body.created_at) update.created_at = body.created_at

  const { data, error } = await db.from('split_expenses_transfers')
    .update(update).eq('id', transferId).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  return apiOk(data)
}
