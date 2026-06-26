import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseId = url.pathname.split('/').pop()

  const db = createAdminClientUntyped()

  const { data: expense, error } = await db.from('split_expenses_expenses')
    .select('*')
    .eq('id', expenseId)
    .single()

  if (error || !expense) return apiError('NOT_FOUND', 'Expense not found', 404)

  // Load shares
  const { data: shares } = await db.from('split_expenses_shares')
    .select('*')
    .eq('expense_id', expenseId)

  // Load profiles
  const userIds = [...new Set([expense.paid_by, ...(shares ?? []).map(s => s.user_id)])]
  const { data: profiles } = await db.from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]))

  return apiOk({
    ...expense,
    paid_by_profile: profileMap.get(expense.paid_by) ?? null,
    shares: (shares ?? []).map(s => ({
      ...s,
      user_profile: profileMap.get(s.user_id) ?? null,
    })),
  })
}
