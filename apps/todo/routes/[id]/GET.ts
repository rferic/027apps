import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing item ID', 400)

  const { data: item, error } = await createAdminClientUntyped()
    .from('todo_items')
    .select('*')
    .eq('id', id)
    .eq('group_id', ctx.groupId)
    .single()

  if (error || !item) return apiError('NOT_FOUND', 'Item not found', 404)

  return apiOk(item)
}
