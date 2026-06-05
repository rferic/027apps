import { cachedQuery } from '@/lib/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanApps } from '@/lib/apps/scanner'

export type AdminUser = {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'member'
  locale: string | null
  joinedAt: string
  lastLoginAt: string | null
  isBlocked: boolean
}

export type AdminStats = {
  totalUsers: number
  admins: number
  members: number
  pendingInvitations: number
  installedApps: number
  totalApps: number
  totalGroups: number
}

export const getAdminUserList = cachedQuery(
  async (): Promise<AdminUser[]> => {
    const supabase = createAdminClient()

    const [authResult, membersResult, profilesResult] = await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 100 }),
      supabase.from('group_members').select('user_id, role, joined_at'),
      supabase.from('profiles').select('id, display_name, locale'),
    ])

    const users = authResult.data?.users ?? []
    const members = membersResult.data ?? []
    const profiles = profilesResult.data ?? []

    return users.map((user) => {
      const profile = profiles.find((p) => p.id === user.id)
      const member = members.find((m) => m.user_id === user.id)
      return {
        id: user.id,
        email: user.email ?? '',
        displayName: profile?.display_name ?? user.email?.split('@')[0] ?? 'Unknown',
        role: (member?.role as 'admin' | 'member') ?? 'member',
        locale: profile?.locale ?? null,
        joinedAt: member?.joined_at ?? user.created_at,
        lastLoginAt: user.last_sign_in_at ?? null,
        isBlocked: !!user.banned_until && new Date(user.banned_until) > new Date(),
      }
    })
  },
  ['admin-users'],
  { revalidate: 300, tags: ['admin-users'] }
)

export const getAdminStats = cachedQuery(
  async (): Promise<AdminStats> => {
    const supabase = createAdminClient()

    const [membersResult, pendingInvResult, installedResult, groupsResult] = await Promise.all([
      supabase.from('group_members').select('user_id, role'),
      supabase
        .from('invitations')
        .select('id', { count: 'exact', head: true })
        .is('accepted_at', null)
        .is('revoked_at', null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      supabase.from('installed_apps').select('id', { count: 'exact', head: true }),
      supabase.from('groups').select('id', { count: 'exact', head: true }),
    ])

    const members = membersResult.data ?? []
    const scanned = await scanApps()

    // Contar usuarios únicos (un usuario en N grupos cuenta como 1)
    const uniqueUsers = new Set(members.map(m => m.user_id))
    const uniqueAdmins = new Set(members.filter(m => m.role === 'admin').map(m => m.user_id))
    const uniqueMembers = new Set(members.filter(m => m.role !== 'admin').map(m => m.user_id))

    return {
      totalUsers: uniqueUsers.size,
      admins: uniqueAdmins.size,
      members: uniqueMembers.size,
      pendingInvitations: pendingInvResult.count ?? 0,
      installedApps: installedResult.count ?? 0,
      totalApps: scanned.length,
      totalGroups: groupsResult.count ?? 0,
    }
  },
  ['admin-stats'],
  { revalidate: 3600, tags: ['admin-stats'] }
)

export async function changeUserRole(
  userId: string,
  newRole: 'admin' | 'member'
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  // Single-group app: always operate on the first group
  const { data: group } = await supabase.from('groups').select('id').limit(1).single()
  if (!group) return { error: 'No group found' }

  const { error } = await supabase
    .from('group_members')
    .update({ role: newRole })
    .eq('user_id', userId)
    .eq('group_id', group.id)

  return { error: error?.message ?? null }
}

export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  const supabase = createAdminClient()

  const [authResult, memberResult, profileResult] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase.from('group_members').select('role, joined_at').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('display_name, locale').eq('id', userId).maybeSingle(),
  ])

  const user = authResult.data?.user
  if (!user) return null

  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profileResult.data?.display_name ?? user.email?.split('@')[0] ?? 'Unknown',
    role: (memberResult.data?.role as 'admin' | 'member') ?? 'member',
    locale: profileResult.data?.locale ?? null,
    joinedAt: memberResult.data?.joined_at ?? user.created_at,
    lastLoginAt: user.last_sign_in_at ?? null,
    isBlocked: !!user.banned_until && new Date(user.banned_until) > new Date(),
  }
}

export async function blockUser(userId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876600h',
  })
  return { error: error?.message ?? null }
}

export async function unblockUser(userId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  return { error: error?.message ?? null }
}

export async function deleteAdminUser(userId: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)
  return { error: error?.message ?? null }
}

export async function updateUserProfile(
  userId: string,
  data: { displayName: string; email: string; locale?: string }
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    email: data.email,
  })
  if (authError) return { error: authError.message }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      display_name: data.displayName,
      ...(data.locale ? { locale: data.locale } : {}),
    })
    .eq('id', userId)

  return { error: profileError?.message ?? null }
}
