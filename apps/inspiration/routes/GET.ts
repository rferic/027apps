import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const VALID_TYPES = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other'] as const
const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate'] as const

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

// Active statuses (used for pending count — excludes completed, rejected, duplicate)
const ACTIVE_STATUSES = 'pending,reviewing,approved,in_progress,on_hold'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const typeParam = url.searchParams.get('type')
  const search = url.searchParams.get('search')
  const sort = url.searchParams.get('sort') || 'newest'
  const appSlug = url.searchParams.get('app_slug')
  const myParam = url.searchParams.get('my')
  const widget = url.searchParams.get('widget')
  const includeCounts = url.searchParams.get('include_counts') === 'true'
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const adminClient = createAdminClientUntyped()

  // Widget mode: return active count + top supported + recently completed in 1 request
  if (widget === 'true') {
    const [activeRes, supportedRes, completedRes] = await Promise.all([
      applyBaseFilters(adminClient.from('inspiration_requests').select('id', { count: 'exact' }), typeParam, search, appSlug, myParam, ctx)
        .in('status', ACTIVE_STATUSES.split(','))
        .eq('group_id', ctx.groupId),
      adminClient.from('inspiration_requests')
        .select('id, title, type, vote_count, comment_count, status, created_at')
        .eq('group_id', ctx.groupId)
        .order('vote_count', { ascending: false })
        .limit(3),
      adminClient.from('inspiration_requests')
        .select('id, title, type, vote_count, comment_count, status, created_at')
        .eq('group_id', ctx.groupId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(2),
    ])

    return apiOk({
      active_count: activeRes.count ?? 0,
      top_supported: supportedRes.data ?? [],
      recently_completed: completedRes.data ?? [],
    })
  }

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

  // 1. Get total count (no head:true — unreliable with PostgREST schema cache)
  const countRes = await applyFilters(
    adminClient.from('inspiration_requests').select('id', { count: 'exact' })
  )
  const total = countRes.count ?? 0
  const countError = countRes.error
  if (countError) {
    return apiError('QUERY_ERROR', `Count failed: ${countError.message}`, 500)
  }

  // Fetch extra counts in parallel if requested (for tab badges)
  let pendingCount = 0
  let completedCount = 0
  if (includeCounts && total > 0) {
    const [pendingRes, completedRes] = await Promise.all([
      applyBaseFilters(adminClient.from('inspiration_requests').select('id', { count: 'exact' }), typeParam, search, appSlug, myParam, ctx)
        .in('status', ACTIVE_STATUSES.split(',')),
      applyBaseFilters(adminClient.from('inspiration_requests').select('id', { count: 'exact' }), typeParam, search, appSlug, myParam, ctx)
        .eq('status', 'completed'),
    ])
    pendingCount = pendingRes.count ?? 0
    completedCount = completedRes.count ?? 0
  }

  if (total === 0) {
    const response: any = {
      data: [],
      pagination: { page, limit, total: 0, total_pages: 0 },
    }
    if (includeCounts) response.counts = { total: 0, pending: 0, completed: 0 }
    return apiOk(response)
  }

  const totalPages = Math.ceil(total / limit)

  // 2. Fetch paginated data
  let dataQuery = applyFilters(adminClient.from('inspiration_requests').select('*'))
  if (sort === 'oldest') dataQuery = dataQuery.order('created_at', { ascending: true })
  else dataQuery = dataQuery.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  dataQuery = dataQuery.range(offset, offset + limit - 1)

  const { data: rows, error: dataError } = await dataQuery
  if (dataError) return apiError('QUERY_ERROR', dataError.message, 500)

  if (!rows || rows.length === 0) {
    const response: any = {
      data: [],
      pagination: { page, limit, total, total_pages: totalPages },
    }
    if (includeCounts) response.counts = { total, pending: pendingCount, completed: completedCount }
    return apiOk(response)
  }

  // 3. Enrich with vote/comment counts + creator info
  const allIds = rows.map((r: Record<string, unknown>) => r.id as string)
  const allUserIds = [...new Set(rows.map((r: Record<string, unknown>) => r.user_id as string))]
  const [votesRes, commentsRes, userVotesRes, profilesRes] = await Promise.all([
    adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds),
    adminClient.from('inspiration_comments').select('request_id').in('request_id', allIds),
    ctx.userId
      ? adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds).eq('user_id', ctx.userId)
      : Promise.resolve({ data: [] }),
    allUserIds.length > 0
      ? adminClient.from('profiles').select('id, display_name, avatar_url').in('id', allUserIds)
      : Promise.resolve({ data: [] }),
  ])

  const voteCounts = new Map<string, number>()
  votesRes.data?.forEach((v: any) => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))
  const commentCounts = new Map<string, number>()
  commentsRes.data?.forEach((c: any) => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))
  const userVoteSet = new Set<string>()
  userVotesRes.data?.forEach((v: any) => userVoteSet.add(v.request_id))
  const profileMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]))

  const enriched = rows.map((r: Record<string, unknown>) => {
    const profile = profileMap.get(r.user_id as string)
    return {
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
      user_has_voted: userVoteSet.has(r.id as string),
      creator: profile
        ? { display_name: profile.display_name, avatar_url: profile.avatar_url }
        : null,
    }
  })

  const response: any = {
    data: enriched,
    pagination: { page, limit, total, total_pages: totalPages },
  }
  if (includeCounts) response.counts = { total, pending: pendingCount, completed: completedCount }

  return apiOk(response)
}

// Helper: apply base filters (no status/type — handled separately for count queries)
function applyBaseFilters(q: any, typeParam: string | null, search: string | null, appSlug: string | null, myParam: string | null, ctx: HandlerContext): any {
  if (typeParam) {
    const types = typeParam.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t as typeof VALID_TYPES[number]))
    if (types.length > 0) q = q.in('type', types)
  }
  if (appSlug) q = q.eq('app_slug', appSlug)
  if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  if (myParam === '1' && ctx.userId) q = q.eq('user_id', ctx.userId)
  return q
}
