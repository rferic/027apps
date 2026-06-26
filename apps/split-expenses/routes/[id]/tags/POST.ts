import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const name = body.name as string | undefined
  if (!name || !name.trim()) return apiError('BAD_REQUEST', 'name is required', 400)

  const color = (body.color as string) || '#6B7280'

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: tag, error } = await db.from('split_expenses_tags').insert({
    expense_group_id: expenseGroupId,
    name: name.trim(),
    color,
  }).select().single()

  if (error) {
    if (error.code === '23505') return apiError('CONFLICT', 'A tag with this name already exists', 409)
    return apiError('CREATE_FAILED', error.message, 500)
  }

  return apiOk(tag, 201)
}
