import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyNewIdea } from '@/lib/use-cases/inspiration/send-notifications'
import type { HandlerContext } from '@/lib/apps/router-types'

const VALID_TYPES = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400)
  }

  if (typeof body !== 'object' || body === null) {
    return apiError('BAD_REQUEST', 'Body must be an object', 400)
  }

  const { title, description, type, app_slug } = body as Record<string, unknown>

  if (typeof title !== 'string' || !title.trim()) {
    return apiError('VALIDATION_ERROR', 'title is required', 422)
  }
  if (typeof type !== 'string' || !VALID_TYPES.includes(type)) {
    return apiError('VALIDATION_ERROR', `type must be one of: ${VALID_TYPES.join(', ')}`, 422)
  }

  const desc = typeof description === 'string' ? description.trim() : ''
  const slug = app_slug !== undefined && app_slug !== null ? String(app_slug) : null

  const adminClient = createAdminClientUntyped()
  const { data, error } = await adminClient
    .from('inspiration_requests')
    .insert({
      user_id: auth.userId,
      title: title.trim(),
      description: desc,
      type,
      app_slug: slug,
      group_id: ctx.groupId,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) return apiError('INSERT_ERROR', error.message, 500)

  // Notify admins asynchronously (best-effort)
  const { data: profile } = await adminClient
    .from('profiles')
    .select('display_name')
    .eq('id', auth.userId)
    .maybeSingle()

  const authorName = (profile as { display_name?: string } | null)?.display_name ?? 'Someone'
  const origin = req.headers.get('Origin') ?? new URL(req.url).origin
  void notifyNewIdea(data.id as string, auth.userId, authorName, slug, origin)

  return apiOk(data, 201)
}
