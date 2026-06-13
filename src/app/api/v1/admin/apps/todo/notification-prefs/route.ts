import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const db = createAdminClientUntyped()
  const { data } = await db.from('todo_notification_prefs').select('*')
  return apiOk(data ?? [])
}

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const targetUserId = body.user_id as string
  if (!targetUserId) return apiError('BAD_REQUEST', 'Missing user_id', 400)

  const prefs: Record<string, unknown> = { user_id: targetUserId, updated_at: new Date().toISOString() }
  if (typeof body.on_assigned === 'boolean') prefs.on_assigned = body.on_assigned
  if (typeof body.on_status_change === 'boolean') prefs.on_status_change = body.on_status_change

  const db = createAdminClientUntyped()
  const { error } = await db.from('todo_notification_prefs').upsert(prefs)
  if (error) return apiError('UPDATE_FAILED', error.message, 500)
  return apiOk(prefs)
}
