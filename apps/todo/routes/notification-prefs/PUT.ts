import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { authenticate } from '@/lib/api/auth'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }

  const prefs: Record<string, unknown> = { user_id: auth.userId, updated_at: new Date().toISOString() }
  if (typeof body.on_assigned === 'boolean') prefs.on_assigned = body.on_assigned
  if (typeof body.on_status_change === 'boolean') prefs.on_status_change = body.on_status_change
  if (typeof body.on_updated === 'boolean') prefs.on_updated = body.on_updated

  const db = createAdminClientUntyped()
  const { error } = await db.from('todo_notification_prefs').upsert(prefs)

  if (error) return apiError('UPDATE_FAILED', error.message, 500)
  return apiOk(prefs)
}
