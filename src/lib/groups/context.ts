import { cachedQuery } from '@/lib/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export interface GroupContext {
  id: string
  name: string
  slug: string
  role: 'admin' | 'member'
}

export async function resolveGroupContext(
  slug: string,
  userId: string
): Promise<GroupContext | null> {
  const adminClient = createAdminClient()

  const { data: group } = await adminClient
    .from('groups')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!group) return null

  const { data: membership } = await adminClient
    .from('group_members')
    .select('role')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .single()

  if (!membership) return null

  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    role: membership.role as 'admin' | 'member',
  }
}

export const getUserGroups = cachedQuery(
  async (userId: string): Promise<GroupContext[]> => {
    const adminClient = createAdminClient()

    const { data: memberships } = await adminClient
      .from('group_members')
      .select('role, groups!inner(id, name, slug)')
      .eq('user_id', userId)

    if (!memberships) return []

    return memberships.map((m: { role: string; groups: { id: string; name: string; slug: string } }) => ({
      id: m.groups.id,
      name: m.groups.name,
      slug: m.groups.slug,
      role: m.role as 'admin' | 'member',
    }))
  },
  ['user-groups'],
  { revalidate: 3600, tags: ['user-groups'] }
)

const LAST_GROUP_COOKIE = 'last_group'

export async function getLastGroupCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(LAST_GROUP_COOKIE)?.value ?? null
}

export function LAST_GROUP_COOKIE_NAME() {
  return LAST_GROUP_COOKIE
}
