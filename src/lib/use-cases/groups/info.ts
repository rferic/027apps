import { createAdminClient } from '@/lib/supabase/admin'

export interface GroupMemberInfo {
  displayName: string
  role: string
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberInfo[]> {
  const admin = createAdminClient()
  const [membersRes, profilesRes] = await Promise.all([
    admin.from('group_members').select('user_id, role').eq('group_id', groupId),
    admin.from('profiles').select('id, display_name'),
  ])
  const profiles = profilesRes.data ?? []
  return (membersRes.data ?? []).map((m) => {
    const profile = profiles.find((p) => p.id === m.user_id)
    return {
      displayName: profile?.display_name ?? 'Desconocido',
      role: m.role,
    }
  })
}
