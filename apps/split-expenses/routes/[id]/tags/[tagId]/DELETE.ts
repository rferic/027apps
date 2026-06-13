import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const tagId = new URL(req.url).pathname.split('/').pop()

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('split_expenses_tags')
    .select('id').eq('id', tagId).single()
  if (!existing) return apiError('NOT_FOUND', 'Tag not found', 404)

  const { error } = await db.from('split_expenses_tags').delete().eq('id', tagId)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
