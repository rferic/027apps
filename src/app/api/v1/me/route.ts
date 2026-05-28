import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('display_name, avatar_url, locale')
    .eq('id', auth.userId!)
    .maybeSingle()

  return apiOk({
    id: auth.userId!,
    email: auth.email ?? '',
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    locale: profile?.locale ?? null,
    role: auth.role!,
    group_id: auth.groupId,
  })
}
