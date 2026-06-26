import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(_req: Request, ctx: HandlerContext) {
  const db = createAdminClientUntyped()

  // Get all expense groups for this 027apps group
  const { data: expenseGroups } = await db.from('split_expenses_groups')
    .select('id')
    .eq('group_id', ctx.groupId)

  if (!expenseGroups || expenseGroups.length === 0) return apiOk([])

  const groupIds = expenseGroups.map(g => g.id)
  const { data: tags } = await db.from('split_expenses_tags')
    .select('*')
    .in('expense_group_id', groupIds)
    .order('name', { ascending: true })

  return apiOk(tags ?? [])
}
