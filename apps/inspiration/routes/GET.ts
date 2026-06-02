import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const VALID_TYPES = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other'] as const
const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate'] as const

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const typeParam = url.searchParams.get('type')
  const search = url.searchParams.get('search')
  const sort = url.searchParams.get('sort') || 'newest'
  const appSlug = url.searchParams.get('app_slug')
  const myParam = url.searchParams.get('my')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const adminClient = createAdminClientUntyped()

  // Helper: apply filters to an existing query builder (no .select() — caller decides)
  function applyFilters<T>(query: T): T {
    let q: any = (query as any).eq('group_id', ctx.groupId)

    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]))
      if (statuses.length > 0) q = q.in('status', statuses)
    }

    if (typeParam) {
      const types = typeParam.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t as typeof VALID_TYPES[number]))
      if (types.length > 0) q = q.in('type', types)
    }

    if (appSlug) {
      q = q.eq('app_slug', appSlug)
    }

    if (search) {
      q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (myParam === '1' && ctx.userId) {
      q = q.eq('user_id', ctx.userId)
    }

    return q as T
  }

  // 1. Total count (select with head:true on PostgrestQueryBuilder, before filters)
  const countQuery = applyFilters(
    adminClient.from('inspiration_requests').select('*', { count: 'exact', head: true })
  )
  const { count: total, error: countError } = await countQuery

  if (countError) return apiError('QUERY_ERROR', countError.message, 500)
  if (!total || total === 0) {
    return apiOk({
      data: [],
      pagination: { page, limit, total: total ?? 0, total_pages: 0 },
    })
  }

  const totalPages = Math.ceil(total / limit)
  const isAggregateSort = sort === 'most_supported' || sort === 'most_commented'

  let requests: Record<string, unknown>[]

  if (isAggregateSort) {
    // For aggregate sorts, fetch ALL matching rows (no limit), enrich, sort in memory, then paginate
    const allQuery = applyFilters(adminClient.from('inspiration_requests').select('*'))
    const { data: allRequests, error: allError } = await allQuery

    if (allError) return apiError('QUERY_ERROR', allError.message, 500)
    if (!allRequests || allRequests.length === 0) {
      return apiOk({
        data: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      })
    }

    const allIds = allRequests.map(r => r.id)

    // Enrich ALL rows with vote/comment counts
    const [{ data: votes }, { data: comments }, { data: userVotes }] = await Promise.all([
      adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds),
      adminClient.from('inspiration_comments').select('request_id').in('request_id', allIds),
      ctx.userId
        ? adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds).eq('user_id', ctx.userId)
        : Promise.resolve({ data: [] }),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach(v => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))

    const commentCounts = new Map<string, number>()
    comments?.forEach(c => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))

    const userVoteSet = new Set<string>()
    userVotes?.forEach(v => userVoteSet.add(v.request_id))

    const enrichedAll = allRequests.map((r: Record<string, unknown>) => ({
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
      user_has_voted: userVoteSet.has(r.id as string),
    }))

    if (sort === 'most_supported') {
      enrichedAll.sort((a, b) => b.vote_count - a.vote_count)
    } else {
      enrichedAll.sort((a, b) => b.comment_count - a.comment_count)
    }

    // Paginate in memory
    const offset = (page - 1) * limit
    requests = enrichedAll.slice(offset, offset + limit)
  } else {
    // For date-based sorts, paginate at DB level
    const offset = (page - 1) * limit
    const dataQuery = applyFilters(adminClient.from('inspiration_requests').select('*'))
      .order('created_at', { ascending: sort === 'oldest' })
      .range(offset, offset + limit - 1)

    const { data: rows, error: dataError } = await dataQuery

    if (dataError) return apiError('QUERY_ERROR', dataError.message, 500)
    if (!rows || rows.length === 0) {
      return apiOk({
        data: [],
        pagination: { page, limit, total, total_pages: totalPages },
      })
    }

    const rowIds = rows.map(r => r.id)

    // Enrich only the paginated rows
    const [{ data: votes }, { data: comments }, { data: userVotes }] = await Promise.all([
      adminClient.from('inspiration_votes').select('request_id').in('request_id', rowIds),
      adminClient.from('inspiration_comments').select('request_id').in('request_id', rowIds),
      ctx.userId
        ? adminClient.from('inspiration_votes').select('request_id').in('request_id', rowIds).eq('user_id', ctx.userId)
        : Promise.resolve({ data: [] }),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach(v => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))

    const commentCounts = new Map<string, number>()
    comments?.forEach(c => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))

    const userVoteSet = new Set<string>()
    userVotes?.forEach(v => userVoteSet.add(v.request_id))

    requests = rows.map((r: Record<string, unknown>) => ({
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
      user_has_voted: userVoteSet.has(r.id as string),
    }))
  }

  return apiOk({
    data: requests,
    pagination: { page, limit, total, total_pages: totalPages },
  })
}
