import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const userId = body.user_id as string | undefined
  if (!userId) return apiError('BAD_REQUEST', 'user_id is required', 400)

  const db = createAdminClientUntyped()

  // Verify expense group exists
  const { data: group } = await db.from('split_expenses_groups')
    .select('id').eq('id', expenseGroupId).eq('group_id', ctx.groupId).single()
  if (!group) return apiError('NOT_FOUND', 'Expense group not found', 404)

  // Check not already a member
  const { data: existing } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', userId).maybeSingle()
  if (existing) return apiError('CONFLICT', 'User is already a member', 409)

  const { data: member, error } = await db.from('split_expenses_members').insert({
    expense_group_id: expenseGroupId,
    user_id: userId,
    active: true,
  }).select().single()

  if (error) return apiError('CREATE_FAILED', error.message, 500)
  return apiOk(member, 201)
}
