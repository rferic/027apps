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

  const { data: settlements } = await db.from('split_expenses_settlements')
    .select('*')
    .eq('expense_group_id', expenseGroupId)
    .order('created_at', { ascending: false })

  // Enrich with creator profile
  const userIds = [...new Set((settlements ?? []).map(s => s.settled_by))]
  const { data: profiles } = await db.from('profiles')
    .select('id, display_name').in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  const enriched = await Promise.all((settlements ?? []).map(async (s) => {
    const { count } = await db.from('split_expenses_settlement_items')
      .select('*', { count: 'exact', head: true })
      .eq('settlement_id', s.id)

    const { data: tx } = await db.from('split_expenses_transfers')
      .select('*').eq('settlement_id', s.id)

    return {
      ...s,
      settled_by_name: profileMap.get(s.settled_by) ?? null,
      expense_count: count ?? 0,
      transfers: tx ?? [],
    }
  }))

  return apiOk(enriched)
}
