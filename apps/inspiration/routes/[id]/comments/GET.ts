import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const inspIndex = segments.indexOf('inspiration')
  const requestId = segments[inspIndex + 1]
  if (!requestId) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const offset = (page - 1) * limit

  const adminClient = createAdminClientUntyped()

  // Verify request exists and belongs to group
  const { data: request } = await adminClient
    .from('inspiration_requests')
    .select('id')
    .eq('id', requestId)
    .eq('group_id', ctx.groupId)
    .maybeSingle()

  if (!request) return apiError('NOT_FOUND', 'Request not found', 404)

  // Count total comments
  const { count: total, error: countError } = await adminClient
    .from('inspiration_comments')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId)

  if (countError) return apiError('QUERY_ERROR', countError.message, 500)
  if (!total || total === 0) {
    return apiOk({
      data: [],
      pagination: { page, limit, total: total ?? 0, total_pages: 0 },
    })
  }

  const totalPages = Math.ceil(total / limit)

  // Fetch comments page, oldest first
  const { data: comments, error } = await adminClient
    .from('inspiration_comments')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) return apiError('QUERY_ERROR', error.message, 500)
  if (!comments || comments.length === 0) {
    return apiOk({
      data: [],
      pagination: { page, limit, total, total_pages: totalPages },
    })
  }

  // Enrich with user info from profiles (best-effort, single query)
  const userIds = [...new Set(comments.map(c => c.user_id))]
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds)

  if (profilesError) {
    // profiles table likely doesn't exist, return without enrichment
    return apiOk({
      data: comments,
      pagination: { page, limit, total, total_pages: totalPages },
    })
  }

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  const enriched = comments.map(c => ({
    ...c,
    user: profileMap.has(c.user_id)
      ? {
          display_name: profileMap.get(c.user_id)!.display_name,
          avatar_url: profileMap.get(c.user_id)!.avatar_url,
        }
      : undefined,
  }))

  return apiOk({
    data: enriched,
    pagination: { page, limit, total, total_pages: totalPages },
  })
}
