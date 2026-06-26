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
  const dateStart = url.searchParams.get('date_start')
  const dateEnd = url.searchParams.get('date_end')

  const db = createAdminClientUntyped()

  const { data: membership } = await db.from('split_expenses_members')
    .select('id').eq('expense_group_id', expenseGroupId).eq('user_id', ctx.userId).single()
  if (!membership) return apiError('FORBIDDEN', 'Not a member', 403)

  let query = db.from('split_expenses_transfers')
    .select('id, from_user, to_user, amount, status, is_manual, note, created_at', { count: 'exact' })
    .eq('expense_group_id', expenseGroupId)
    .eq('status', 'completed')

  if (dateStart) query = query.gte('created_at', dateStart)
  if (dateEnd) query = query.lte('created_at', dateEnd + 'T23:59:59.999Z')

  query = query.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: rows, error, count } = await query
  if (error) return apiError('QUERY_ERROR', error.message, 500)

  const userIds = [...new Set((rows ?? []).flatMap(t => [t.from_user, t.to_user]))]

  const { data: profiles } = await db.from('profiles')
    .select('id, display_name').in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  const enriched = (rows ?? []).map(t => ({
    ...t,
    from_name: profileMap.get(t.from_user) ?? null,
    to_name: profileMap.get(t.to_user) ?? null,
  }))

  const total = count ?? 0
  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
}
