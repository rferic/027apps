import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const db = createAdminClientUntyped()
  const { data } = await db
    .from('todo_notification_prefs')
    .select('*')
    .eq('user_id', ctx.userId)
    .maybeSingle()

  return apiOk(data ?? { user_id: ctx.userId, on_assigned: true, on_status_change: false, on_updated: false })
}
