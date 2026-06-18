import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  const period = url.searchParams.get('period') || 'month'
  const tagId = url.searchParams.get('tag_id')

  const validPeriods = ['day', 'week', 'month', 'year']
  if (!validPeriods.includes(period)) return apiError('BAD_REQUEST', 'period must be day, week, month, or year', 400)

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  let query = db.from('split_expenses_expenses')
    .select('amount, created_at')
    .eq('expense_group_id', expenseGroupId)
    .eq('settled', false)
    .order('created_at', { ascending: true })

  if (tagId) query = query.eq('tag_id', tagId)

  const { data: expenses, error } = await query
  if (error) return apiError('QUERY_ERROR', error.message, 500)

  // Group by period
  const grouped = new Map<string, number>()
  const now = new Date()

  for (const expense of expenses ?? []) {
    const d = new Date(expense.created_at)
    let label: string

    switch (period) {
      case 'day':
        label = d.toISOString().slice(0, 10)
        break
      case 'week': {
        const startOfWeek = new Date(d)
        startOfWeek.setDate(d.getDate() - d.getDay())
        label = startOfWeek.toISOString().slice(0, 10)
        break
      }
      case 'month':
        label = d.toISOString().slice(0, 7)
        break
      case 'year':
        label = d.toISOString().slice(0, 4)
        break
      default:
        label = d.toISOString().slice(0, 7)
    }

    grouped.set(label, (grouped.get(label) ?? 0) + parseFloat(expense.amount))
  }

  const data = Array.from(grouped.entries()).map(([label, total]) => ({
    label,
    total: Math.round(total * 100) / 100,
  }))

  // Also compute cumulative
  let cumulative = 0
  const cumulativeData = data.map(d => {
    cumulative += d.total
    return { label: d.label, total: Math.round(cumulative * 100) / 100 }
  })

  return apiOk({ byPeriod: data, cumulative: cumulativeData })
}
