import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const segments = new URL(req.url).pathname.split('/')
  const expenseGroupId = segments.at(-2)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: members } = await db.from('split_expenses_members')
    .select('id, expense_group_id, user_id, active, created_at')
    .eq('expense_group_id', expenseGroupId)

  // Load profiles
  const userIds = [...new Set((members ?? []).map(m => m.user_id))]
  const { data: profiles } = await db.from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]))

  const enriched = (members ?? []).map(m => ({
    ...m,
    display_name: profileMap.get(m.user_id)?.display_name ?? null,
    avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
  }))

  return apiOk(enriched)
}
