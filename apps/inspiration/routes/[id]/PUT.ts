import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyStatusChange } from '@/lib/use-cases/inspiration/send-notifications'
import type { HandlerContext } from '@/lib/apps/router-types'

const VALID_TYPES = ['bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other']
const VALID_STATUSES = ['pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate']

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', 400)
  }
  if (typeof body !== 'object' || body === null) {
    return apiError('BAD_REQUEST', 'Body must be an object', 400)
  }

  const { title, description, type, app_slug, status } = body as Record<string, unknown>

  const adminClient = createAdminClientUntyped()

  // Fetch existing request
  const { data: existing, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return apiError('NOT_FOUND', 'Request not found', 404)

  const isAdmin = auth.role === 'admin'
  const isCreator = existing.user_id === auth.userId

  if (!isAdmin && !isCreator) {
    return apiError('FORBIDDEN', 'You do not have permission to update this request', 403)
  }

  const updates: Record<string, unknown> = {}

  if (typeof title === 'string' && title.trim()) {
    updates.title = title.trim()
  }
  if (typeof description === 'string') {
    updates.description = description.trim()
  }
  if (typeof type === 'string' && VALID_TYPES.includes(type)) {
    updates.type = type
  }
  if (app_slug !== undefined) {
    updates.app_slug = app_slug === null ? null : String(app_slug)
  }

  let oldStatusValue = ''
  let statusChanged = false

  if (isAdmin && typeof status === 'string' && VALID_STATUSES.includes(status)) {
    oldStatusValue = existing.status as string
    updates.status = status
    if (status !== oldStatusValue) {
      statusChanged = true
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError('VALIDATION_ERROR', 'No valid fields to update', 422)
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await adminClient
    .from('inspiration_requests')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return apiError('UPDATE_ERROR', error.message, 500)

  // Fire notification after successful DB update (don't block response)
  if (statusChanged) {
    void notifyStatusChange(id, oldStatusValue, status as string, undefined, 'en')
      .catch(err => console.error('[Inspiration] Failed to send status change notification:', err))
  }

  return apiOk(data)
}
