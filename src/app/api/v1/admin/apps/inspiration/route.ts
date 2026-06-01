import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

const VALID_TYPES = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']
const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate']

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const typeParam = url.searchParams.get('type')
  const search = url.searchParams.get('search')
  const sort = url.searchParams.get('sort') || 'newest'
  const appSlug = url.searchParams.get('app_slug')
  const groupSlug = url.searchParams.get('group_slug')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const adminClient = createAdminClientUntyped()

  // Resolve group ID from slug if provided
  let groupId: string | null = null
  if (groupSlug) {
    const { data: group } = await adminClient
      .from('groups')
      .select('id')
      .eq('slug', groupSlug)
      .maybeSingle()
    if (group) groupId = (group as Record<string, unknown>).id as string
  }

  // Pre-validate filter params
  const statuses = statusParam
    ? statusParam.split(',').map(s => s.trim()).filter(s => (VALID_STATUSES as readonly string[]).includes(s))
    : []
  const types = typeParam
    ? typeParam.split(',').map(t => t.trim()).filter(t => (VALID_TYPES as readonly string[]).includes(t))
    : []

  // Helper: apply filters to an existing query builder
  function applyFilters(query: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = query as any

    if (statuses.length > 0) q = q.in('status', statuses)
    if (types.length > 0) q = q.in('type', types)
    if (appSlug) q = q.eq('app_slug', appSlug)
    if (groupId) q = q.eq('group_id', groupId)
    if (search) q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    return q
  }

  // Count
  let total: number | null = null
  let countError: unknown = null
  try {
    const countQuery = applyFilters(
      adminClient.from('inspiration_requests').select('id', { count: 'exact' })
    )
    const result = await countQuery
    total = result.count
    countError = result.error
  } catch (e) {
    return apiError('QUERY_ERROR', `Count exception: ${e instanceof Error ? e.message : String(e)}`, 500)
  }

  if (countError) return apiError('QUERY_ERROR', `Count failed: ${JSON.stringify({ message: (countError as any).message, code: (countError as any).code, details: (countError as any).details, hint: (countError as any).hint })}`, 500)
  if (!total || total === 0) {
    return apiOk({ data: [], pagination: { page, limit, total: total ?? 0, total_pages: 0 } })
  }

  const totalPages = Math.ceil(total / limit)
  const isAggregateSort = sort === 'most_supported' || sort === 'most_commented'

  let requests: Array<Record<string, unknown>>

  if (isAggregateSort) {
    // For aggregate sorts, fetch ALL matching rows, enrich, sort in memory, then paginate
    const allQuery = applyFilters(adminClient.from('inspiration_requests').select('*'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allQueryResult: any = await (allQuery as any)
    const allRequests = allQueryResult.data as Array<Record<string, unknown>> | null
    const allError = allQueryResult.error

    if (allError) return apiError('QUERY_ERROR', `All query: ${allError.message} (${allError.code || 'no code'})`, 500)
    if (!allRequests || allRequests.length === 0) {
      return apiOk({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } })
    }

    const allIds = allRequests.map(r => r.id)
    const [{ data: votes }, { data: comments }] = await Promise.all([
      adminClient.from('inspiration_votes').select('request_id').in('request_id', allIds),
      adminClient.from('inspiration_comments').select('request_id').in('request_id', allIds),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach(v => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))
    const commentCounts = new Map<string, number>()
    comments?.forEach(c => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))

    const enrichedAll = allRequests.map(r => ({
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
    }))

    if (sort === 'most_supported') {
      enrichedAll.sort((a, b) => b.vote_count - a.vote_count)
    } else {
      enrichedAll.sort((a, b) => b.comment_count - a.comment_count)
    }

    const offset = (page - 1) * limit
    requests = enrichedAll.slice(offset, offset + limit)
  } else {
    // For date-based sorts, paginate at DB level
    const offset = (page - 1) * limit
    const dataQuery = applyFilters(adminClient.from('inspiration_requests').select('*'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dataQuery as any).order('created_at', { ascending: sort === 'oldest' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(dataQuery as any).range(offset, offset + limit - 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataQueryResult: any = await (dataQuery as any)
    const rows = dataQueryResult.data as Array<Record<string, unknown>> | null
    const dataError = dataQueryResult.error

    if (dataError) return apiError('QUERY_ERROR', dataError.message, 500)
    if (!rows || rows.length === 0) {
      return apiOk({ data: [], pagination: { page, limit, total, total_pages: totalPages } })
    }

    const rowIds = rows.map(r => r.id)
    const [{ data: votes }, { data: comments }] = await Promise.all([
      adminClient.from('inspiration_votes').select('request_id').in('request_id', rowIds),
      adminClient.from('inspiration_comments').select('request_id').in('request_id', rowIds),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach(v => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))
    const commentCounts = new Map<string, number>()
    comments?.forEach(c => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))

    requests = rows.map(r => ({
      ...r,
      vote_count: voteCounts.get(r.id as string) || 0,
      comment_count: commentCounts.get(r.id as string) || 0,
    }))
  }

  // Enrich with groups and profiles (best-effort)
  const groupIds = [...new Set(requests.map(r => r.group_id).filter(Boolean))]
  const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))]

  const [groupsRes, profilesRes] = await Promise.allSettled([
    groupIds.length > 0
      ? adminClient.from('groups').select('id, name, slug').in('id', groupIds as string[])
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? adminClient.from('profiles').select('id, display_name, avatar_url').in('id', userIds as string[])
      : Promise.resolve({ data: [] }),
  ])

  const groupMap = new Map<string, { name: string; slug: string }>()
  if (groupsRes.status === 'fulfilled' && groupsRes.value.data) {
    for (const g of groupsRes.value.data) {
      groupMap.set(g.id, { name: g.name, slug: g.slug })
    }
  }

  const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>()
  if (profilesRes.status === 'fulfilled' && profilesRes.value.data) {
    for (const p of profilesRes.value.data) {
      profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
    }
  }

  const enriched = requests.map(r => {
    const group = groupMap.get(r.group_id as string)
    const profile = profileMap.get(r.user_id as string)
    return {
      ...r,
      group_slug: group?.slug ?? null,
      group_name: group?.name ?? null,
      creator: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null,
    }
  })

  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: totalPages },
  })
}
