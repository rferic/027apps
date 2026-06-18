import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const title = body.title as string | undefined
  const amount = parseFloat(body.amount as string)
  const paidBy = body.paid_by as string | undefined
  const participantIds = body.participant_ids as string[] | undefined
  const tagId = body.tag_id as string | undefined

  if (!title || !title.trim()) return apiError('BAD_REQUEST', 'title is required', 400)
  if (!amount || isNaN(amount) || amount <= 0) return apiError('BAD_REQUEST', 'amount must be greater than 0', 400)
  if (!paidBy) return apiError('BAD_REQUEST', 'paid_by is required', 400)
  if (!participantIds || participantIds.length === 0) return apiError('BAD_REQUEST', 'Select at least one participant', 400)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  // Verify expense group exists
  const { data: group } = await db.from('split_expenses_groups')
    .select('id').eq('id', expenseGroupId).eq('group_id', ctx.groupId).single()
  if (!group) return apiError('NOT_FOUND', 'Expense group not found', 404)

  // Create expense
  const { data: expense, error: expenseErr } = await db.from('split_expenses_expenses').insert({
    expense_group_id: expenseGroupId,
    title: title.trim(),
    amount,
    paid_by: paidBy,
    tag_id: tagId || null,
    created_by: ctx.userId,
  }).select().single()

  if (expenseErr) return apiError('CREATE_FAILED', expenseErr.message, 500)

  // Create shares (equal split)
  const shareAmount = Math.round((amount / participantIds.length) * 100) / 100
  const remainder = Math.round((amount - shareAmount * participantIds.length) * 100) / 100

  const shares = participantIds.map((userId, i) => ({
    expense_id: expense.id,
    user_id: userId,
    amount: i === 0 ? shareAmount + remainder : shareAmount,
  }))

  const { error: sharesErr } = await db.from('split_expenses_shares').insert(shares)
  if (sharesErr) return apiError('CREATE_FAILED', sharesErr.message, 500)

  return apiOk({ ...expense, shares }, 201)
}
