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
  const type = url.searchParams.get('type') // 'expenses' | 'transfers' | undefined (all)
  const dateStart = url.searchParams.get('date_start')
  const dateEnd = url.searchParams.get('date_end')

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  // Build a unified list using two queries + in-app merge
  const queries: Promise<any>[] = []
  if (!type || type === 'expenses') {
    let q = db.from('split_expenses_expenses')
      .select('id, title, amount, paid_by, tag_id, created_by, created_at, expense_group_id', { count: 'exact' })
      .eq('expense_group_id', expenseGroupId)
    if (dateStart) q = q.gte('created_at', dateStart)
    if (dateEnd) q = q.lte('created_at', dateEnd + 'T23:59:59.999Z')
    queries.push(q as any)
  } else {
    queries.push(Promise.resolve({ data: [], count: 0 }))
  }

  if (!type || type === 'transfers') {
    let q = db.from('split_expenses_transfers')
      .select('id, from_user, to_user, amount, status, is_manual, note, settlement_id, created_at, expense_group_id', { count: 'exact' })
      .eq('expense_group_id', expenseGroupId)
    if (dateStart) q = q.gte('created_at', dateStart)
    if (dateEnd) q = q.lte('created_at', dateEnd + 'T23:59:59.999Z')
    queries.push(q as any)
  } else {
    queries.push(Promise.resolve({ data: [], count: 0 }))
  }

  const [expResult, trResult] = await Promise.all(queries)
  const expenses = (expResult.data ?? []).map((e: any) => ({ ...e, _type: 'expense' }))
  const transfers = (trResult.data ?? []).map((t: any) => ({ ...t, _type: 'transfer' }))

  // Merge and sort by created_at descending
  const all = [...expenses, ...transfers].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const total = all.length
  const start = (page - 1) * limit
  const paged = all.slice(start, start + limit)

  // Enrich with profiles
  const userIds = new Set<string>()
  for (const item of paged) {
    if (item._type === 'expense') userIds.add(item.paid_by)
    else { userIds.add(item.from_user); userIds.add(item.to_user) }
  }

  const { data: profiles } = await db.from('profiles').select('id, display_name').in('id', [...userIds])
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]))

  const enriched = paged.map((item: any) => {
    if (item._type === 'expense') {
      return { ...item, paid_by_name: profileMap.get(item.paid_by) ?? null }
    }
    return { ...item, from_name: profileMap.get(item.from_user) ?? null, to_name: profileMap.get(item.to_user) ?? null }
  })

  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
}
