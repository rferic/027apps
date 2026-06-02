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

  // Build the base query with filters (no .select yet)
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

  // 1. Get total count
  const countRes = await applyFilters(
    adminClient.from('inspiration_requests').select('*', { count: 'exact', head: true })
  )
  const { count: total, error: countError } = await countRes

  // Count query failed — treat as 0, don't block
  const effectiveTotal = (countError || !total) ? 0 : total
  const totalPages = effectiveTotal > 0 ? Math.ceil(effectiveTotal / limit) : 0

  if (!effectiveTotal) {
    // Double-check: maybe the table is empty
    const { data: verifyRows, error: verifyErr } = await adminClient
      .from('inspiration_requests')
      .select('id')
      .limit(1)
    if (verifyErr) return apiError('QUERY_ERROR', `count_failed:${countError?.message} verify_failed:${verifyErr.message}`, 500)
    if (!verifyRows || verifyRows.length === 0) {
      return apiOk({
        data: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      })
    }
    // Count was 0 but rows exist — recount the hard way
    const { data: allRows } = await adminClient.from('inspiration_requests').select('id')
    const realTotal = allRows?.length ?? 0
    if (realTotal === 0) {
      return apiOk({
        data: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
      })
    }
    const offset2 = (page - 1) * limit
    const { data: rows2, error: dataErr2 } = await applyFilters(
      adminClient.from('inspiration_requests').select('*')
    )
    if (dataErr2) return apiError('QUERY_ERROR', dataErr2.message, 500)
    if (!rows2 || rows2.length === 0) {
      return apiOk({
        data: [],
        pagination: { page, limit, total: realTotal, total_pages: Math.ceil(realTotal / limit) },
      })
    }
    const sorted2 = [...rows2].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === 'oldest') sorted2.reverse()
    const sliced2 = sorted2.slice(offset2, offset2 + limit)
    return apiOk({
      data: sliced2,
      pagination: { page, limit, total: realTotal, total_pages: Math.ceil(realTotal / limit) },
    })
  }

  // 2. Fetch paginated data
  let dataQuery = applyFilters(adminClient.from('inspiration_requests').select('*'))
  if (sort === 'oldest') dataQuery = dataQuery.order('created_at', { ascending: true })
  else dataQuery = dataQuery.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  dataQuery = dataQuery.range(offset, offset + limit - 1)

  const { data: rows, error: dataError } = await dataQuery
  if (dataError) return apiError('QUERY_ERROR', dataError.message, 500)

  if (!rows || rows.length === 0) {
    return apiOk({
      data: [],
      pagination: { page, limit, total: effectiveTotal, total_pages: totalPages },
    })
  }

  // 3. Enrich with vote/comment counts
  const allIds = rows.map(r => r.id)
  const [votesRes, commentsRes, userVotesRes] = await Promise.all([
    adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds),
    adminClient.from('inspiration_comments').select('request_id').in('request_id', allIds),
    ctx.userId
      ? adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds).eq('user_id', ctx.userId)
      : Promise.resolve({ data: [] }),
  ])

  const voteCounts = new Map<string, number>()
  votesRes.data?.forEach((v: any) => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))
  const commentCounts = new Map<string, number>()
  commentsRes.data?.forEach((c: any) => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))
  const userVoteSet = new Set<string>()
  userVotesRes.data?.forEach((v: any) => userVoteSet.add(v.request_id))

  const enriched = rows.map((r: Record<string, unknown>) => ({
    ...r,
    vote_count: voteCounts.get(r.id as string) || 0,
    comment_count: commentCounts.get(r.id as string) || 0,
    user_has_voted: userVoteSet.has(r.id as string),
  }))

  return apiOk({
    data: enriched,
    pagination: { page, limit, total: effectiveTotal, total_pages: totalPages },
  })
}
