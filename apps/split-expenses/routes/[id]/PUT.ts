import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', id).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  const { data: existing } = await db.from('split_expenses_groups')
    .select('*').eq('id', id).eq('group_id', ctx.groupId).single()
  if (!existing) return apiError('NOT_FOUND', 'Expense group not found', 404)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
  if (typeof body.emoji === 'string') update.emoji = body.emoji
  if (typeof body.currency === 'string') update.currency = body.currency

  const { data, error } = await db.from('split_expenses_groups')
    .update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  return apiOk(data)
}
