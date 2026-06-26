import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const settlementId = new URL(req.url).pathname.split('/').pop()

  const db = createAdminClientUntyped()

  const expenseGroupId = new URL(req.url).pathname.split('/').at(-3)
  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: settlement } = await db.from('split_expenses_settlements')
    .select('*').eq('id', settlementId).single()

  if (!settlement) return apiError('NOT_FOUND', 'Settlement not found', 404)

  const { data: transfers } = await db.from('split_expenses_transfers')
    .select('*').eq('settlement_id', settlementId)

  const userIds = [...new Set([
    settlement.settled_by,
    ...(transfers ?? []).flatMap(t => [t.from_user, t.to_user]),
  ])]

  const { data: profiles } = await db.from('profiles')
    .select('id, display_name').in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  return apiOk({
    ...settlement,
    settled_by_name: profileMap.get(settlement.settled_by) ?? null,
    transfers: (transfers ?? []).map(t => ({
      ...t,
      from_name: profileMap.get(t.from_user) ?? null,
      to_name: profileMap.get(t.to_user) ?? null,
    })),
  })
}
