import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const title = body.title as string | undefined
  if (!title || !title.trim()) return apiError('BAD_REQUEST', 'Title is required', 400)

  const emoji = (body.emoji as string) || '💰'
  const currency = (body.currency as string) || 'EUR'

  const db = createAdminClientUntyped()

  const { data: group, error } = await db.from('split_expenses_groups').insert({
    group_id: ctx.groupId,
    title: title.trim(),
    emoji,
    currency,
    created_by: ctx.userId,
  }).select().single()

  if (error) return apiError('CREATE_FAILED', error.message, 500)

  // Auto-add creator as active member
  await db.from('split_expenses_members').insert({
    expense_group_id: group.id,
    user_id: ctx.userId,
    active: true,
  }).maybeSingle()

  // Add additional members if specified
  const memberIds = body.members as string[] | undefined
  if (Array.isArray(memberIds)) {
    const members = memberIds
      .filter(id => id && id !== ctx.userId)
      .map(user_id => ({ expense_group_id: group.id, user_id, active: true }))
    if (members.length > 0) {
      await db.from('split_expenses_members').insert(members).maybeSingle()
    }
  }

  return apiOk(group, 201)
}
