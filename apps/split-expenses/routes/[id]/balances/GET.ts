import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'
import { calculateBalances, optimizeTransfers } from '../../../debt-optimizer'
import type { Expense } from '../../../debt-optimizer'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: expenses } = await db.from('split_expenses_expenses')
    .select('id, paid_by, amount')
    .eq('expense_group_id', expenseGroupId)
    .eq('settled', false)

  if (!expenses || expenses.length === 0) {
    const { data: members } = await db.from('split_expenses_members')
      .select('user_id').eq('expense_group_id', expenseGroupId).eq('active', true)

    const { data: profiles } = await db.from('profiles')
      .select('id, display_name').in('id', (members ?? []).map(m => m.user_id))

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

    return apiOk({
      balances: (members ?? []).map(m => ({
        user_id: m.user_id,
        display_name: profileMap.get(m.user_id) ?? null,
        net_balance: 0,
      })),
      transfers: [],
    })
  }

  const expenseIds = expenses.map(e => e.id)
  const { data: allShares } = await db.from('split_expenses_shares')
    .select('*')
    .in('expense_id', expenseIds)

  const sharesByExpense = new Map<string, typeof allShares>()
  for (const share of allShares ?? []) {
    const list = sharesByExpense.get(share.expense_id) ?? []
    list.push(share)
    sharesByExpense.set(share.expense_id, list)
  }

  const optimizerExpenses: Expense[] = expenses.map(e => ({
    id: e.id,
    paid_by: e.paid_by,
    amount: parseFloat(e.amount),
    shares: (sharesByExpense.get(e.id) ?? []).map(s => ({
      user_id: s.user_id,
      amount: parseFloat(s.amount),
    })),
  }))

  const balances = calculateBalances(optimizerExpenses)
  const rawTransfers = optimizeTransfers(balances.map(b => ({ ...b })))

  const userIds = [...new Set([...balances.map(b => b.user_id), ...rawTransfers.map(t => t.from_user), ...rawTransfers.map(t => t.to_user)])]
  const { data: profiles } = await db.from('profiles')
    .select('id, display_name')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  const result = {
    balances: balances.map(b => ({ ...b, display_name: profileMap.get(b.user_id) ?? null })),
    transfers: rawTransfers.map(t => ({
      ...t, from_name: profileMap.get(t.from_user) ?? null, to_name: profileMap.get(t.to_user) ?? null,
    })),
  }
  return apiOk(result)
}
