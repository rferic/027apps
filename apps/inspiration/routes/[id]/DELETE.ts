import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const adminClient = createAdminClientUntyped()

  // Fetch existing to check ownership
  const { data: existing, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('user_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return apiError('NOT_FOUND', 'Request not found', 404)

  const isAdmin = auth.role === 'admin'
  const isCreator = existing.user_id === auth.userId

  if (!isAdmin && !isCreator) {
    return apiError('FORBIDDEN', 'You do not have permission to delete this request', 403)
  }

  const { error } = await adminClient
    .from('inspiration_requests')
    .delete()
    .eq('id', id)

  if (error) return apiError('DELETE_ERROR', error.message, 500)
  return apiOk({ deleted: true })
}
