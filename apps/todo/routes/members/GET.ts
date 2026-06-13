import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(_req: Request, ctx: HandlerContext) {
  const db = createAdminClientUntyped()

  const { data: members } = await db
    .from('group_members')
    .select('user_id')
    .eq('group_id', ctx.groupId)

  if (!members || members.length === 0) return apiOk([])

  const userIds = members.map(m => m.user_id)
  const { data: profiles } = await db
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)

  const result = (members ?? []).map(m => {
    const profile = (profiles ?? []).find(p => p.id === m.user_id)
    return { user_id: m.user_id, display_name: profile?.display_name ?? 'Unknown' }
  })

  return apiOk(result)
}
