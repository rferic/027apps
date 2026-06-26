import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const db = createAdminClientUntyped()

  let query = db.from('split_expenses_groups').select('*', { count: 'exact' })
    .eq('group_id', ctx.groupId)

  const sort = url.searchParams.get('sort') || 'newest'
  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'alpha') query = query.order('title', { ascending: true })
  else query = query.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: rows, error, count } = await query
  if (error) return apiError('QUERY_ERROR', error.message, 500)

  // Enrich each group with member count and current user's balance
  const enriched = await Promise.all((rows ?? []).map(async (group) => {
    const [{ count: memberCount }, { data: expenses }] = await Promise.all([
      db.from('split_expenses_members').select('*', { count: 'exact', head: true }).eq('expense_group_id', group.id),
      db.from('split_expenses_expenses').select('id, paid_by, amount').eq('expense_group_id', group.id),
    ])
    const expenseIds = (expenses ?? []).map(e => e.id)
    const totalAmount = (expenses ?? []).reduce((sum, e) => sum + parseFloat(e.amount), 0)
    const myPaid = (expenses ?? []).filter(e => e.paid_by === ctx.userId).reduce((sum, e) => sum + parseFloat(e.amount), 0)
    let myBalance = 0
    if (expenseIds.length > 0) {
      const { data: shares } = await db.from('split_expenses_shares')
        .select('user_id, expense_id, amount').in('expense_id', expenseIds)
      for (const s of shares ?? []) {
        if (s.user_id === ctx.userId) myBalance -= parseFloat(s.amount)
      }
      for (const e of expenses ?? []) {
        if (e.paid_by === ctx.userId) {
          const totalShares = (shares ?? []).filter(s => s.expense_id === e.id).reduce((sum, s) => sum + parseFloat(s.amount), 0)
          myBalance += totalShares
        }
      }
    }
    // Subtract completed transfers
    const { data: transfers } = await db.from('split_expenses_transfers')
      .select('from_user, to_user, amount').eq('expense_group_id', group.id).eq('status', 'completed')

    // Calculate group-wide pending: sum of positive net balances after transfers
    const netMap: Record<string, number> = {}
    for (const e of expenses ?? []) {
      netMap[e.paid_by] = (netMap[e.paid_by] ?? 0) + parseFloat(e.amount)
    }
    if (expenseIds.length > 0) {
      const { data: allShares } = await db.from('split_expenses_shares')
        .select('user_id, expense_id, amount').in('expense_id', expenseIds)
      for (const s of allShares ?? []) {
        netMap[s.user_id] = (netMap[s.user_id] ?? 0) - parseFloat(s.amount)
      }
    }
    for (const t of transfers ?? []) {
      netMap[t.from_user] = (netMap[t.from_user] ?? 0) + parseFloat(t.amount)
      netMap[t.to_user] = (netMap[t.to_user] ?? 0) - parseFloat(t.amount)
      if (t.from_user === ctx.userId) myBalance += parseFloat(t.amount)
      if (t.to_user === ctx.userId) myBalance -= parseFloat(t.amount)
    }
    const pendingAmount = Object.values(netMap).filter(v => v > 0).reduce((sum, v) => sum + v, 0)
    return { ...group, member_count: memberCount ?? 0, my_balance: Math.round(myBalance * 100) / 100, total_amount: Math.round(totalAmount * 100) / 100, my_paid: Math.round(myPaid * 100) / 100, pending_amount: Math.round(pendingAmount * 100) / 100 }
  }))

  const total = count ?? 0
  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
}
