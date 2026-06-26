import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const expenseGroupId = url.pathname.split('/').at(-2)

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const tagId = url.searchParams.get('tag_id')
  const dateStart = url.searchParams.get('date_start')
  const dateEnd = url.searchParams.get('date_end')
  const paidBy = url.searchParams.get('paid_by')
  const sort = url.searchParams.get('sort') || 'newest'

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member of this expense group', 403)

  let query = db.from('split_expenses_expenses').select('id, paid_by, amount, title, tag_id, created_by, created_at, expense_group_id', { count: 'exact' })
    .eq('expense_group_id', expenseGroupId)

  if (tagId) query = query.eq('tag_id', tagId)
  if (dateStart) query = query.gte('created_at', dateStart)
  if (dateEnd) query = query.lte('created_at', dateEnd + 'T23:59:59.999Z')
  if (paidBy) query = query.eq('paid_by', paidBy)

  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'amount_asc') query = query.order('amount', { ascending: true })
  else if (sort === 'amount_desc') query = query.order('amount', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: rows, error, count } = await query
  if (error) return apiError('QUERY_ERROR', error.message, 500)

  const expenseIds = (rows ?? []).map(e => e.id)
  const [sharesResult, profilesResult] = await Promise.all([
    expenseIds.length > 0
      ? db.from('split_expenses_shares').select('*').in('expense_id', expenseIds)
      : { data: [] },
    db.from('profiles').select('id, display_name, avatar_url')
      .in('id', (rows ?? []).map(e => e.paid_by)),
  ])

  const allShares = sharesResult.data ?? []
  const profiles = profilesResult.data ?? []

  const profileMap = new Map((profiles ?? []).map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]))
  const sharesByExpense = new Map<string, typeof allShares>()
  for (const share of allShares ?? []) {
    const list = sharesByExpense.get(share.expense_id) ?? []
    list.push(share)
    sharesByExpense.set(share.expense_id, list)
  }

  const allUserIds = [...new Set(allShares.map(s => s.user_id))]
  if (allUserIds.length > 0 && !allUserIds.every(id => profileMap.has(id))) {
    const { data: extraProfiles } = await db.from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', allUserIds.filter(id => !profileMap.has(id)))
    for (const p of extraProfiles ?? []) profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
  }

  const enriched = (rows ?? []).map(e => ({
    ...e,
    paid_by_profile: profileMap.get(e.paid_by) ?? null,
    shares: (sharesByExpense.get(e.id) ?? []).map(s => ({
      ...s,
      user_profile: profileMap.get(s.user_id) ?? null,
    })),
  }))

  const total = count ?? 0
  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
}
