import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const memberId = new URL(req.url).pathname.split('/').pop()

  const db = createAdminClientUntyped()

  const { data: existing } = await db.from('split_expenses_members')
    .select('id').eq('id', memberId).single()
  if (!existing) return apiError('NOT_FOUND', 'Member not found', 404)

  const { error } = await db.from('split_expenses_members').delete().eq('id', memberId)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
