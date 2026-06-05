import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, _ctx: HandlerContext) {
  const id = new URL(req.url).pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing category ID', 400)

  const { error } = await createAdminClientUntyped().from('todo_categories').delete().eq('id', id)
  if (error) return apiError('DELETE_FAILED', error.message, 500)
  return new Response(null, { status: 204 })
}
