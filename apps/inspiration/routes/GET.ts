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

  type Q = ReturnType<ReturnType<typeof createAdminClientUntyped>['from']>

  // Apply filters on a PostgrestFilterBuilder (after .select)
  function applyFilters(q: any): any {
    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]))
      if (statuses.length > 0) q = q.in('status', statuses)
    }
    if (typeParam) {
      const types = typeParam.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t as typeof VALID_TYPES[number]))
      if (types.length > 0) q = q.in('type', types)
    }
    if (appSlug) q = q.eq('app_slug', appSlug)
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    if (myParam === '1' && ctx.userId) q = q.eq('user_id', ctx.userId)
    return q
  }

  const base = adminClient.from('inspiration_requests')

  // Try head count first; if it reports 0, verify with a direct SELECT
  const countRes = await applyFilters(base.select('*', { count: 'exact', head: true }))
  const { count: total, error: countError } = await countRes

  if (countError) return apiError('QUERY_ERROR', countError.message, 500)

  let effectiveTotal = total ?? 0
  if (!effectiveTotal) {
    const verifyRes = await applyFilters(base.select('id').limit(1))
    const { data: verifyRows, error: verifyErr } = await verifyRes
    if (verifyErr) return apiError('QUERY_ERROR', verifyErr.message, 500)
    if (verifyRows && verifyRows.length > 0) {
      // head:true returned 0 but data exists — recount via direct SELECT
      const dataRes = await applyFilters(base.select('*'))
      const { data: allRows } = await dataRes
      effectiveTotal = (allRows && Array.isArray(allRows)) ? allRows.length : 0
      if (!effectiveTotal) {
        return apiOk({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } })
      }
      return buildResponse(adminClient, base, applyFilters, page, limit, sort, ctx, effectiveTotal, allRows!)
    }
    return apiOk({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } })
  }

  return buildResponse(adminClient, base, applyFilters, page, limit, sort, ctx, effectiveTotal)
}

async function buildResponse(
  adminClient: any,
  base: any,
  applyFilters: (q: any) => any,
  page: number,
  limit: number,
  sort: string,
  ctx: HandlerContext,
  total: number,
  preFetchedRows?: Record<string, unknown>[],
) {
  const totalPages = Math.ceil(total / limit)
  const isAggregateSort = sort === 'most_supported' || sort === 'most_commented'

  let requests: Record<string, unknown>[]

  if (isAggregateSort || preFetchedRows) {
    const allRequests = preFetchedRows ?? (await applyFilters(base.select('*')).then((r: any) => r.data)) ?? []
    if (!Array.isArray(allRequests) || allRequests.length === 0) {
      return apiOk({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } })
    }

    const allIds = allRequests.map((r: any) => r.id)

    const [{ data: votes }, { data: comments }, { data: userVotes }] = await Promise.all([
      adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds),
      adminClient.from('inspiration_comments').select('request_id').in('request_id', allIds),
      ctx.userId
        ? adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds).eq('user_id', ctx.userId)
        : Promise.resolve({ data: [] }),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach((v: any) => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))
    const commentCounts = new Map<string, number>()
    comments?.forEach((c: any) => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))
    const userVoteSet = new Set<string>()
    userVotes?.forEach((v: any) => userVoteSet.add(v.request_id))

    const enriched = allRequests.map((r: Record<string, unknown>) => ({
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
      user_has_voted: userVoteSet.has(r.id as string),
    }))

    if (sort === 'most_supported') enriched.sort((a, b) => b.vote_count - a.vote_count)
    else if (sort === 'most_commented') enriched.sort((a, b) => b.comment_count - a.comment_count)

    const offset = (page - 1) * limit
    requests = enriched.slice(offset, offset + limit)
  } else {
    const offset = (page - 1) * limit
    let dataQuery = applyFilters(base.select('*'))
      .order('created_at', { ascending: sort === 'oldest' })
      .range(offset, offset + limit - 1)

    const { data: rows, error: dataError } = await dataQuery
    if (dataError) return apiError('QUERY_ERROR', dataError.message, 500)
    if (!rows || rows.length === 0) {
      return apiOk({ data: [], pagination: { page, limit, total, total_pages: totalPages } })
    }

    const rowIds = rows.map((r: any) => r.id)

    const [{ data: votes }, { data: comments }, { data: userVotes }] = await Promise.all([
      adminClient.from('inspiration_votes').select('request_id').in('request_id', rowIds),
      adminClient.from('inspiration_comments').select('request_id').in('request_id', rowIds),
      ctx.userId
        ? adminClient.from('inspiration_votes').select('request_id').in('request_id', rowIds).eq('user_id', ctx.userId)
        : Promise.resolve({ data: [] }),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach((v: any) => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))
    const commentCounts = new Map<string, number>()
    comments?.forEach((c: any) => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))
    const userVoteSet = new Set<string>()
    userVotes?.forEach((v: any) => userVoteSet.add(v.request_id))

    requests = rows.map((r: Record<string, unknown>) => ({
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
      user_has_voted: userVoteSet.has(r.id as string),
    }))
  }

  return apiOk({
    data: requests,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
}
