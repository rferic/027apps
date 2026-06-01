import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyNewComment } from '@/lib/use-cases/inspiration/send-notifications'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

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

  // Verify request exists and belongs to group
  const { data: request } = await adminClient
    .from('inspiration_requests')
    .select('id')
    .eq('id', requestId)
    .eq('group_id', ctx.groupId)
    .maybeSingle()

  if (!request) return apiError('NOT_FOUND', 'Request not found', 404)

  // Insert comment
  const { data: comment, error } = await adminClient
    .from('inspiration_comments')
    .insert({
      request_id: requestId,
      user_id: auth.userId,
      body: rawBody.trim(),
    })
    .select('*')
    .single()

  if (error) return apiError('INSERT_ERROR', error.message, 500)

  // Fire-and-forget: send notification (don't block the response)
  void notifyNewComment(requestId, auth.userId, rawBody.trim().slice(0, 150), 'en')
    .catch(err => console.error('[Inspiration] Failed to send comment notification:', err))

  return apiOk(comment, 201)
}
