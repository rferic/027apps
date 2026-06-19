import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-3)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const fromUser = body.from_user as string
  const toUser = body.to_user as string
  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount as string)
  const note = (body.note as string) || null

  if (!fromUser || !toUser) return apiError('BAD_REQUEST', 'from_user and to_user are required', 400)
  if (!amount || amount <= 0 || isNaN(amount)) return apiError('BAD_REQUEST', 'amount must be positive', 400)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: group } = await db.from('split_expenses_groups')
    .select('id').eq('id', expenseGroupId).eq('group_id', ctx.groupId).single()
  if (!group) return apiError('NOT_FOUND', 'Expense group not found', 404)

  const { data: payment, error: insertErr } = await db.from('split_expenses_transfers').insert({
    expense_group_id: expenseGroupId,
    settlement_id: null,
    from_user: fromUser,
    to_user: toUser,
    amount,
    status: 'completed',
    is_manual: true,
    note,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single()

  if (insertErr) return apiError('CREATE_FAILED', insertErr.message, 500)

  return apiOk({ payment }, 201)
}
