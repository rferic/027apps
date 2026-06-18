import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', id).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: group, error } = await db.from('split_expenses_groups')
    .select('*')
    .eq('id', id)
    .eq('group_id', ctx.groupId)
    .single()

  if (error || !group) return apiError('NOT_FOUND', 'Expense group not found', 404)

  // Load members with user profile info
  const { data: members } = await db.from('split_expenses_members')
    .select('id, expense_group_id, user_id, active, created_at')
    .eq('expense_group_id', id)

  // Load user profiles for display_name
  const userIds = [...new Set((members ?? []).map(m => m.user_id))]
  const { data: profiles } = await db.from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]))

  const enrichedMembers = (members ?? []).map(m => ({
    ...m,
    display_name: profileMap.get(m.user_id)?.display_name ?? null,
    avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
  }))

  return apiOk({ ...group, members: enrichedMembers })
}
