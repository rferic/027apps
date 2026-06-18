import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const memberId = url.pathname.split('/').pop()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  if (typeof body.active !== 'boolean') return apiError('BAD_REQUEST', 'active (boolean) is required', 400)

  const db = createAdminClientUntyped()

  const expenseGroupId = new URL(req.url).pathname.split('/').at(-3)
  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: existing } = await db.from('split_expenses_members')
    .select('id').eq('id', memberId).single()
  if (!existing) return apiError('NOT_FOUND', 'Member not found', 404)

  const { data, error } = await db.from('split_expenses_members')
    .update({ active: body.active, updated_at: new Date().toISOString() })
    .eq('id', memberId).select().single()

  if (error) return apiError('UPDATE_FAILED', error.message, 500)
  return apiOk(data)
}
