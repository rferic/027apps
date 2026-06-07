import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing item ID', 400)

  const { error } = await createAdminClientUntyped()
    .from('todo_items')
    .delete()
    .eq('id', id)
    .eq('group_id', ctx.groupId)

  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}