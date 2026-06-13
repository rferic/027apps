import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseId = url.pathname.split('/').pop()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('split_expenses_expenses')
    .select('*').eq('id', expenseId).single()

  if (!existing) return apiError('NOT_FOUND', 'Expense not found', 404)
  if (existing.settled) return apiError('CONFLICT', 'Cannot edit a settled expense', 409)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) update.title = body.title.trim()
  if (body.amount !== undefined) {
    const amount = parseFloat(body.amount as string)
    if (isNaN(amount) || amount <= 0) return apiError('BAD_REQUEST', 'amount must be greater than 0', 400)
    update.amount = amount
  }
  if (typeof body.paid_by === 'string') update.paid_by = body.paid_by
  if (body.tag_id !== undefined) update.tag_id = body.tag_id || null

  const { data, error } = await db.from('split_expenses_expenses')
    .update(update).eq('id', expenseId).select().single()

  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  // Update shares if participant_ids provided
  const participantIds = body.participant_ids as string[] | undefined
  if (Array.isArray(participantIds) && participantIds.length > 0) {
    const amount = (update.amount as number) ?? existing.amount
    const shareAmount = Math.round((amount / participantIds.length) * 100) / 100
    const remainder = Math.round((amount - shareAmount * participantIds.length) * 100) / 100

    await db.from('split_expenses_shares').delete().eq('expense_id', expenseId)

    const shares = participantIds.map((userId, i) => ({
      expense_id: expenseId,
      user_id: userId,
      amount: i === 0 ? shareAmount + remainder : shareAmount,
    }))

    const { error: sharesErr } = await db.from('split_expenses_shares').insert(shares)
    if (sharesErr) return apiError('UPDATE_FAILED', sharesErr.message, 500)

    return apiOk({ ...data, shares })
  }

  // Return existing shares if not updated
  const { data: shares } = await db.from('split_expenses_shares')
    .select('*').eq('expense_id', expenseId)
  return apiOk({ ...data, shares: shares ?? [] })
}
