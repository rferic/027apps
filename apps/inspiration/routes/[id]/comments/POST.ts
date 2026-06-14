import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyNewComment } from '@/lib/use-cases/inspiration/send-notifications'
import { createComment } from '@/lib/use-cases/inspiration/github'
import { getAppSetting } from '@/lib/use-cases/app-settings'
import type { HandlerContext } from '@/lib/apps/router-types'

async function syncCommentToGitHubIssue(requestId: string, body: string, userId: string) {
  const adminClient = createAdminClientUntyped()
  const { data: idea } = await adminClient
    .from('inspiration_requests')
    .select('github_issue_number')
    .eq('id', requestId)
    .single()

  if (!idea?.github_issue_number) return

  const { data: profile } = await adminClient
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()

  const displayName = (profile as { display_name?: string } | null)?.display_name ?? 'Someone'
  const commentBody = `**${displayName}:**\n\n${body}`
  await createComment(idea.github_issue_number, commentBody)
}

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const inspIndex = segments.indexOf('inspiration')
  const requestId = segments[inspIndex + 1]
  if (!requestId) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400)
  }
  if (typeof body !== 'object' || body === null) {
    return apiError('BAD_REQUEST', 'Body must be an object', 400)
  }

  const { body: rawBody } = body as Record<string, unknown>
  if (typeof rawBody !== 'string' || !rawBody.trim()) {
    return apiError('VALIDATION_ERROR', 'body is required and must not be empty', 422)
  }

  const adminClient = createAdminClientUntyped()

  // Verify request exists
  const { data: request } = await adminClient
    .from('inspiration_requests')
    .select('id')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) return apiError('NOT_FOUND', 'Request not found', 404)

  // Insert comment
  const { data: comment, error } = await adminClient
    .from('inspiration_comments')
    .insert({
      request_id: requestId,
      user_id: ctx.userId,
      body: rawBody.trim(),
    })
    .select('*')
    .single()

  if (error) return apiError('INSERT_ERROR', error.message, 500)

  // Fire-and-forget: send notification (don't block the response)
  void notifyNewComment(requestId, ctx.userId, rawBody.trim().slice(0, 150), 'en')
    .catch(err => console.error('[Inspiration] Failed to send comment notification:', err))

  // Sync comment to GitHub issue if the idea has one
  void syncCommentToGitHubIssue(requestId, rawBody.trim(), ctx.userId)
    .catch(err => console.error('[Inspiration] Failed to sync comment to GitHub:', err))

  return apiOk(comment, 201)
}
