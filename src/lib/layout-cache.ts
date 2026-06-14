import { cachedQuery } from '@/lib/cache'
import { createAdminClient, createAdminClientUntyped } from '@/lib/supabase/admin'

export const getActiveApps = cachedQuery(
  async (): Promise<{ slug: string; visibility: string }[]> => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('installed_apps')
      .select('slug, visibility')
      .eq('status', 'active')
      .order('display_order')
      .order('installed_at')
    return (data ?? []) as { slug: string; visibility: string }[]
  },
  ['active-apps'],
  { revalidate: 300, tags: ['installed-apps'] }
)

export const getGroupAppAccess = cachedQuery(
  async (groupId: string): Promise<string[]> => {
    const untyped = createAdminClientUntyped()
    const { data } = await untyped
      .from('group_app_access')
      .select('app_slug')
      .eq('group_id', groupId)
    return (data ?? []).map((r: { app_slug: string }) => r.app_slug)
  },
  ['group-app-access'],
  { revalidate: 300, tags: ['group-app-access'] }
)

export const getGroupMemberCounts = cachedQuery(
  async (groupIds: string[]): Promise<Record<string, number>> => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)
    const counts: Record<string, number> = {}
    ;(data ?? []).forEach((m: { group_id: string }) => {
      counts[m.group_id] = (counts[m.group_id] || 0) + 1
    })
    return counts
  },
  ['group-member-counts'],
  { revalidate: 300, tags: ['group-member-counts'] }
)
