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

  // Fetch ALL matching rows with count in a single query (avoids head:true issues)
  let query = adminClient.from('inspiration_requests').select('*', { count: 'exact' })

  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(s => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]))
    if (statuses.length > 0) query = query.in('status', statuses)
  }
  if (typeParam) {
    const types = typeParam.split(',').map(t => t.trim()).filter(t => VALID_TYPES.includes(t as typeof VALID_TYPES[number]))
    if (types.length > 0) query = query.in('type', types)
  }
  if (appSlug) query = query.eq('app_slug', appSlug)
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
  if (myParam === '1' && ctx.userId) query = query.eq('user_id', ctx.userId)

  const { data: allRequests, count: total, error } = await query

  if (error) return apiError('QUERY_ERROR', error.message, 500)

  if (!allRequests || allRequests.length === 0) {
    return apiOk({
      data: [],
      pagination: { page, limit, total: total ?? 0, total_pages: 0 },
    })
  }

  const effectiveTotal = total ?? allRequests.length
  const allIds = allRequests.map(r => r.id)

  // Enrich with vote and comment counts
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

  const enriched = allRequests.map(r => ({
    ...r,
    vote_count: voteCounts.get(r.id as string) || 0,
    comment_count: commentCounts.get(r.id as string) || 0,
    user_has_voted: userVoteSet.has(r.id as string),
  }))

  // Sort in memory
  if (sort === 'most_supported') enriched.sort((a, b) => b.vote_count - a.vote_count)
  else if (sort === 'most_commented') enriched.sort((a, b) => b.comment_count - a.comment_count)
  else enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sort === 'oldest') enriched.reverse()

  // Paginate in memory
  const offset = (page - 1) * limit
  const requests = enriched.slice(offset, offset + limit)

  return apiOk({
    data: requests,
    pagination: { page, limit, total: effectiveTotal, total_pages: Math.ceil(effectiveTotal / limit) },
  })
}
