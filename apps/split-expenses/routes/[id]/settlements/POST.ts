import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'
import { calculateBalances, optimizeTransfers } from '../../../debt-optimizer'
import type { Expense } from '../../../debt-optimizer'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const note = (body.note as string) || null
  const expenseIds = body.expense_ids as string[] | undefined
  const settleUsers = body.settle_users as string[] | undefined

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: group } = await db.from('split_expenses_groups')
    .select('id').eq('id', expenseGroupId).eq('group_id', ctx.groupId).single()
  if (!group) return apiError('NOT_FOUND', 'Expense group not found', 404)

  let expensesToSettle
  if (Array.isArray(expenseIds) && expenseIds.length > 0) {
    const { data: exps } = await db.from('split_expenses_expenses')
      .select('id, paid_by, amount')
      .eq('expense_group_id', expenseGroupId)
      .in('id', expenseIds)
    expensesToSettle = exps
  } else {
    const { data: exps } = await db.from('split_expenses_expenses')
      .select('id, paid_by, amount')
      .eq('expense_group_id', expenseGroupId)
    expensesToSettle = exps
  }

  if (!expensesToSettle || expensesToSettle.length === 0) {
    return apiError('BAD_REQUEST', 'No expenses found', 400)
  }

  const settleIds = expensesToSettle.map(e => e.id)
  const { data: allShares } = await db.from('split_expenses_shares')
    .select('*').in('expense_id', settleIds)

  const sharesByExpense = new Map<string, typeof allShares>()
  for (const share of allShares ?? []) {
    const list = sharesByExpense.get(share.expense_id) ?? []
    list.push(share)
    sharesByExpense.set(share.expense_id, list)
  }

  // Filter shares by settle_users if provided (partial settlement)
  let optimizerExpenses: Expense[] = expensesToSettle.map(e => ({
    id: e.id,
    paid_by: e.paid_by,
    shares: (sharesByExpense.get(e.id) ?? [])
      .filter(s => {
        // Always include the payer's share (they owe themselves nothing)
        // Filter to only selected users
        if (!settleUsers || settleUsers.length === 0) return true
        return settleUsers.includes(s.user_id) || s.user_id === e.paid_by
      })
      .map(s => ({
        user_id: s.user_id,
        amount: parseFloat(s.amount),
      })),
  }))

  const balances = calculateBalances(optimizerExpenses)
  const transfers = optimizeTransfers(balances)

  if (transfers.length === 0) {
    return apiError('BAD_REQUEST', 'No transfers needed for the selected users', 400)
  }

  const { data: settlement, error: settleErr } = await db.from('split_expenses_settlements').insert({
    expense_group_id: expenseGroupId,
    settled_by: ctx.userId,
    note,
  }).select().single()

  if (settleErr) return apiError('CREATE_FAILED', settleErr.message, 500)

  const transferRows = transfers.map(t => ({
    expense_group_id: expenseGroupId,
    settlement_id: settlement.id,
    from_user: t.from_user,
    to_user: t.to_user,
    amount: t.amount,
    status: 'completed',
  }))
  await db.from('split_expenses_transfers').insert(transferRows)

  return apiOk({
    settlement,
    transfers_created: transfers.length,
    transfers,
  }, 201)
}
