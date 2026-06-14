import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export const PUT = withTiming(async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const on_assigned = typeof body.on_assigned === 'boolean' ? body.on_assigned : true
  const on_status_change = typeof body.on_status_change === 'boolean' ? body.on_status_change : true

  const db = createAdminClientUntyped()

  // Get all users who have tasks or notification prefs
  const { data: existingPrefs } = await db.from('todo_notification_prefs').select('user_id')
  const { data: todoCreators } = await db.from('todo_items').select('created_by')
  const userIds = new Set<string>()
  if (existingPrefs) existingPrefs.forEach(p => userIds.add(p.user_id))
  if (todoCreators) todoCreators.forEach(t => userIds.add(t.created_by))

  // Also get all group members
  const { data: members } = await db.from('group_members').select('user_id')
  if (members) members.forEach(m => userIds.add(m.user_id))

  if (userIds.size === 0) return apiOk({ updated: 0 })

  const records = [...userIds].map(user_id => ({
    user_id,
    on_assigned,
    on_status_change,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db.from('todo_notification_prefs').upsert(records, { onConflict: 'user_id' })
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  return apiOk({ updated: records.length })
})
