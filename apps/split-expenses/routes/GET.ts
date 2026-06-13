import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const db = createAdminClientUntyped()

  let query = db.from('split_expenses_groups').select('*', { count: 'exact' })
    .eq('group_id', ctx.groupId)

  const sort = url.searchParams.get('sort') || 'newest'
  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'alpha') query = query.order('title', { ascending: true })
  else query = query.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: rows, error, count } = await query
  if (error) return apiError('QUERY_ERROR', error.message, 500)

  // Enrich each group with member count and current user's balance
  const enriched = await Promise.all((rows ?? []).map(async (group) => {
    const { count: memberCount } = await db.from('split_expenses_members')
      .select('*', { count: 'exact', head: true })
      .eq('expense_group_id', group.id)

    return { ...group, member_count: memberCount ?? 0 }
  }))

  const total = count ?? 0
  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
}
