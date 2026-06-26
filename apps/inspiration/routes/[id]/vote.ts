import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'
import { sendPushToUser } from '@/lib/push'
import { NOTIFICATION_TYPES } from '@/lib/push'

export default async function handler(req: Request, ctx: HandlerContext) {
  if (req.method !== 'POST') {
    return apiError('METHOD_NOT_ALLOWED', 'Only POST allowed', 405)
  }

  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const inspIndex = segments.indexOf('inspiration')
  const requestId = segments[inspIndex + 1]
  if (!requestId) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const adminClient = createAdminClientUntyped()

  // Verify request exists
  const { data: request } = await adminClient
    .from('inspiration_requests')
    .select('id')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) return apiError('NOT_FOUND', 'Request not found', 404)

  // Check existing vote
  const { data: existingVote } = await adminClient
    .from('inspiration_votes')
    .select('id')
    .eq('request_id', requestId)
    .eq('user_id', ctx.userId)
    .maybeSingle()

  let voted: boolean

  if (existingVote) {
    // Toggle off: remove vote
    const { error: deleteError } = await adminClient
      .from('inspiration_votes')
      .delete()
      .eq('id', existingVote.id)

    if (deleteError) return apiError('DELETE_ERROR', deleteError.message, 500)
    voted = false
  } else {
    // Toggle on: insert vote
    const { error: insertError } = await adminClient
      .from('inspiration_votes')
      .insert({
        request_id: requestId,
        user_id: ctx.userId,
      })

    if (insertError) {
      // Race condition: parallel request already inserted
      if (insertError.code === '23505') {
        voted = true
      } else {
        return apiError('INSERT_ERROR', insertError.message, 500)
      }
    } else {
      voted = true

      // Notify idea author about the vote (fire-and-forget)
      const { data: idea } = await adminClient
        .from('inspiration_requests')
        .select('user_id, title')
        .eq('id', requestId)
        .maybeSingle()

      if (idea && idea.user_id !== auth.userId) {
        const { data: voter } = await adminClient
          .from('profiles')
          .select('display_name')
          .eq('id', auth.userId)
          .maybeSingle()

        const voterName = (voter as { display_name?: string } | null)?.display_name ?? 'Someone'
        sendPushToUser(idea.user_id, {
          type: NOTIFICATION_TYPES.INSPIRATION_VOTE,
          title: 'Your idea got a vote',
          body: `${voterName} voted for "${idea.title}"`,
          data: { requestId },
        }).catch((err) => console.error('[Inspiration] Failed to send vote push:', err))
      }
    }
  }

  // Count current votes
  const { count: voteCount } = await adminClient
    .from('inspiration_votes')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId)

  return apiOk({ voted, vote_count: voteCount ?? 0 })
}
