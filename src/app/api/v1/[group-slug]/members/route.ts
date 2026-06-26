import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const groupSlug = req.nextUrl.pathname.split('/')[3]
  if (!groupSlug) return apiError('BAD_REQUEST', 'Missing group slug', 400)

  const db = createAdminClientUntyped()

  // Resolve group
  const { data: group } = await db.from('groups').select('id').eq('slug', groupSlug).single()
  if (!group) return apiError('NOT_FOUND', 'Group not found', 404)

  const { data: members } = await db.from('group_members').select('user_id').eq('group_id', group.id)
  if (!members || members.length === 0) return apiOk([])

  const userIds = members.map(m => m.user_id)
  const { data: profiles } = await db.from('profiles').select('id, display_name').in('id', userIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

  const result = members.map(m => ({
    user_id: m.user_id,
    display_name: profileMap.get(m.user_id) ?? 'Unknown',
  }))

  return apiOk(result)
}
