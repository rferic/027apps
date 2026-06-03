import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  const parsedUrl = new URL(req.url)
  const segments = parsedUrl.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing todo ID', 400)

  const adminClient = createAdminClientUntyped()
  const { error } = await adminClient
    .from('todo_items')
    .delete()
    .eq('id', id)
    .eq('group_id', ctx.groupId)
    .eq('user_id', auth.userId)

  if (error) return apiError('DELETE_ERROR', error.message, 500)
  return new Response(null, { status: 204 })
}
