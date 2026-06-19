import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const expenseGroupId = segments.at(-2)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10))
  const offset = (page - 1) * limit

  const { count: total } = await db.from('split_expenses_settlements')
    .select('*', { count: 'exact', head: true })
    .eq('expense_group_id', expenseGroupId)

  const { data: settlements } = await db.from('split_expenses_settlements')
    .select('*')
    .eq('expense_group_id', expenseGroupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Enrich with creator profile
  const userIds = [...new Set((settlements ?? []).map(s => s.settled_by))]
  const { data: profiles } = await db.from('profiles')
    .select('id, display_name').in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  // Enrich settlements with expenses and transfer profiles
  const enriched = await Promise.all((settlements ?? []).map(async (s) => {
    const { count } = await db.from('split_expenses_settlement_items')
      .select('*', { count: 'exact', head: true })
      .eq('settlement_id', s.id)

    const { data: tx } = await db.from('split_expenses_transfers')
      .select('*').eq('settlement_id', s.id)

    // Fetch expense details for this settlement
    const { data: items } = await db.from('split_expenses_settlement_items')
      .select('expense_id').eq('settlement_id', s.id)
    const expenseIds = (items ?? []).map(i => i.expense_id)
    const { data: expenses } = expenseIds.length > 0
      ? await db.from('split_expenses_expenses').select('id, title, amount').in('id', expenseIds)
      : { data: [] }
    const expenseMap = new Map((expenses ?? []).map(e => [e.id, e]))

    // Enrich transfers with profile names
    const txUserIds = [...new Set((tx ?? []).flatMap(t => [t.from_user, t.to_user]))]
    const { data: txProfiles } = txUserIds.length > 0
      ? await db.from('profiles').select('id, display_name').in('id', txUserIds)
      : { data: [] }
    const txProfileMap = new Map((txProfiles ?? []).map(p => [p.id, p.display_name]))

    return {
      ...s,
      settled_by_name: profileMap.get(s.settled_by) ?? null,
      expense_count: count ?? 0,
      transfers: (tx ?? []).map(t => ({
        ...t,
        from_name: txProfileMap.get(t.from_user) ?? null,
        to_name: txProfileMap.get(t.to_user) ?? null,
      })),
      expenses: (items ?? []).map(i => ({ ...i, expense: expenseMap.get(i.expense_id) ?? null })),
    }
  }))

  return apiOk({
    data: enriched,
    pagination: { page, limit, total: total ?? 0, total_pages: Math.ceil((total ?? 0) / limit) },
  })
}
