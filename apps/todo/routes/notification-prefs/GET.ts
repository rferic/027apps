import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { authenticate } from '@/lib/api/auth'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  const db = createAdminClientUntyped()
  const { data } = await db
    .from('todo_notification_prefs')
    .select('*')
    .eq('user_id', auth.userId)
    .maybeSingle()

  return apiOk(data ?? { user_id: auth.userId, on_assigned: true, on_status_change: false, on_updated: false })
}
