import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(_req: Request, _ctx: HandlerContext) {
  const db = createAdminClientUntyped()
  const { data, error } = await db.from('todo_categories').select('*').order('display_order').order('name')
  if (error) return apiError('QUERY_ERROR', error.message, 500)
  return apiOk(data ?? [])
}
