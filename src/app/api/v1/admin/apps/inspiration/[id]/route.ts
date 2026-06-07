import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyStatusChange } from '@/lib/use-cases/inspiration/send-notifications'
import { closeIssue, updateLabels } from '@/lib/use-cases/inspiration/github'
import { syncStatusToGitHubIssue } from '../../../../../../../../apps/inspiration/routes/github-helpers'

const VALID_TYPES = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']
const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const adminClient = createAdminClientUntyped()

  const { data: request, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !request) return apiError('NOT_FOUND', 'Request not found', 404)

  // Enrich: group name/slug, creator profile, comments, votes
  const [groupRes, profileRes, commentsRes, votesRes, voteCountRes] = await Promise.allSettled([
    adminClient.from('groups').select('id, name, slug').eq('id', request.group_id).maybeSingle(),
    adminClient.from('profiles').select('display_name, avatar_url').eq('id', request.user_id).maybeSingle(),
    adminClient.from('inspiration_comments').select('*').eq('request_id', id).order('created_at', { ascending: true }),
    adminClient.from('inspiration_votes').select('user_id').eq('request_id', id),
    adminClient.from('inspiration_votes').select('*', { count: 'exact', head: true }).eq('request_id', id),
  ])

  // ====== Enrichment (untyped Supabase — requires any casts) ======
  /* eslint-disable @typescript-eslint/no-explicit-any */

  // Resolve group info
  const group: any = groupRes.status === 'fulfilled' && (groupRes.value as any).data
    ? { name: (groupRes.value as any).data.name, slug: (groupRes.value as any).data.slug }
    : null

  // Resolve creator profile
  const creator: any = profileRes.status === 'fulfilled' && (profileRes.value as any).data
    ? { display_name: (profileRes.value as any).data.display_name, avatar_url: (profileRes.value as any).data.avatar_url }
    : null

  // Resolve comments with profiles
  let commentsEnriched: any[] = []
  if (commentsRes.status === 'fulfilled' && (commentsRes.value as any).data) {
    const commentUserIds = [...new Set((commentsRes.value as any).data.map((c: { user_id: string }) => c.user_id))]
    let commentProfiles: { id: string; display_name: string; avatar_url: string }[] = []
    try {
      const { data } = await adminClient
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', commentUserIds)
      commentProfiles = (data ?? []) as { id: string; display_name: string; avatar_url: string }[]
    } catch { /* profiles table may not exist */ }

    const profileMap = new Map(commentProfiles.map(p => [p.id, p]))
    commentsEnriched = (commentsRes.value as any).data.map((c: { user_id: string }) => ({
      ...c,
      author: profileMap.get(c.user_id) ?? null,
    }))
  }

  // Resolve votes with profiles
  const rawVoters = (votesRes.status === 'fulfilled' ? (votesRes.value as any).data : null) as { user_id: string }[] | null
  const voterIds: string[] = rawVoters ? [...new Set(rawVoters.map(v => v.user_id))] : []
  let votersEnriched: any[] = []
  if (voterIds.length > 0) {
    let voterProfiles: { id: string; display_name: string; avatar_url: string }[] = []
    try {
      const { data } = await adminClient
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', voterIds)
      voterProfiles = (data ?? []) as { id: string; display_name: string; avatar_url: string }[]
    } catch { /* profiles table may not exist */ }

    const voterMap = new Map(voterProfiles.map(p => [p.id, p]))
    votersEnriched = voterIds.map(uid => ({
      user_id: uid,
      display_name: voterMap.get(uid)?.display_name ?? null,
      avatar_url: voterMap.get(uid)?.avatar_url ?? null,
    }))
  }

  const voteCount: number = voteCountRes.status === 'fulfilled' ? ((voteCountRes.value as any).count ?? 0) : 0

  /* eslint-enable @typescript-eslint/no-explicit-any */

  return apiOk({
    ...request,
    group,
    group_name: group?.name ?? null,
    group_slug: group?.slug ?? null,
    creator,
    vote_count: voteCount,
    comment_count: commentsEnriched.length,
    comments: commentsEnriched,
    voters: votersEnriched,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  let body: unknown
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const { title, description, type, app_slug, status } = body as Record<string, unknown>

  const adminClient = createAdminClientUntyped()

  const { data: existing, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !existing) return apiError('NOT_FOUND', 'Request not found', 404)

  const updates: Record<string, unknown> = {}

  if (typeof title === 'string' && title.trim()) updates.title = title.trim()
  if (typeof description === 'string') updates.description = description.trim()
  if (typeof type === 'string' && VALID_TYPES.includes(type)) updates.type = type
  if (app_slug !== undefined) updates.app_slug = app_slug === null ? null : String(app_slug)

  let oldStatusValue = ''
  let statusChanged = false

  if (typeof status === 'string' && VALID_STATUSES.includes(status)) {
    oldStatusValue = (existing as Record<string, unknown>).status as string
    updates.status = status
    if (status !== oldStatusValue) statusChanged = true
  }

  if (Object.keys(updates).length === 0) return apiError('VALIDATION_ERROR', 'No valid fields to update', 422)

  updates.updated_at = new Date().toISOString()

  const { data, error } = await adminClient
    .from('inspiration_requests')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return apiError('UPDATE_ERROR', error.message, 500)

  if (statusChanged) {
    void notifyStatusChange(id, oldStatusValue, status as string, undefined, 'en')
      .catch(err => console.error('[Inspiration] Failed to send status change notification:', err))
    void syncStatusToGitHubIssue(id, oldStatusValue, status as string)
      .catch(err => console.error('[Inspiration] Failed to sync status to GitHub:', err))
  }

  return apiOk(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const adminClient = createAdminClientUntyped()

  const { data: existing, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('id, github_issue_number')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !existing) return apiError('NOT_FOUND', 'Request not found', 404)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((existing as any).github_issue_number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const num = (existing as any).github_issue_number as number
    void updateLabels(num, ['status: deleted'])
      .catch(err => console.error('[Admin] Failed to label GitHub issue on delete:', err))
    void closeIssue(num)
      .catch(err => console.error('[Admin] Failed to close GitHub issue on idea delete:', err))
  }

  const { error: deleteError } = await adminClient
    .from('inspiration_requests')
    .delete()
    .eq('id', id)

  if (deleteError) return apiError('DELETE_ERROR', deleteError.message, 500)

  return new Response(null, { status: 204 })
}
