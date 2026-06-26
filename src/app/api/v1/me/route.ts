import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk } from '@/lib/api/response'
import { createApiAdminClient } from '@/lib/supabase/api'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const [profileResult, groupsResult] = await Promise.all([
    auth.supabase
      .from('profiles')
      .select('display_name, avatar_url, locale')
      .eq('id', auth.userId!)
      .maybeSingle(),
    createApiAdminClient()
      .from('group_members')
      .select('group_id, role, groups!inner(slug, name)')
      .eq('user_id', auth.userId!),
  ])

  const profile = profileResult.data
  const members = groupsResult.data

  return apiOk({
    id: auth.userId!,
    email: auth.email ?? '',
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    locale: profile?.locale ?? null,
    role: auth.role!,
    group_id: auth.groupId,
    groups: (members ?? []).map(m => ({
      id: m.group_id,
      slug: m.groups?.slug ?? '',
      name: m.groups?.name ?? '',
      role: m.role,
    })),
  })
}
