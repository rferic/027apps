import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'
import { UserGroupsSection } from './UserGroupsSection'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { locale, id } = await params
  setRequestLocale(locale)
  await requireAdmin()

  const adminClient = createAdminClient()

  const { data: authUser } = await adminClient.auth.admin.getUserById(id)
  if (!authUser?.user) notFound()

  const user = authUser.user

  const { data: profile } = await adminClient
    .from('profiles')
    .select('display_name')
    .eq('id', id)
    .single()

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Unknown'

  const { data: memberships } = await adminClient
    .from('group_members')
    .select('group_id, role, groups!inner(name, slug)')
    .eq('user_id', id)

  const userGroups = (memberships ?? []).map((m: { group_id: string; role: string; groups: { name: string; slug: string } }) => ({
    groupId: m.group_id,
    groupName: m.groups.name,
    groupSlug: m.groups.slug,
    role: m.role,
  }))

  const { data: allGroups } = await adminClient
    .from('groups')
    .select('id, name, slug')
    .order('name')

  const availableGroups = (allGroups ?? []).filter(
    g => !userGroups.some(ug => ug.groupId === g.id)
  )

  const t = await getTranslations('admin')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <span className="text-sm font-bold text-muted-foreground">
              {displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="ml-auto">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              user.banned_until && new Date(user.banned_until) > new Date()
                ? 'bg-red-50 text-red-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {user.banned_until && new Date(user.banned_until) > new Date() ? t('users.blocked') : t('users.active')}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('users.joined')}</span>
            <p className="font-medium text-foreground">{new Date(user.created_at).toLocaleDateString(locale)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('users.last_sign_in')}</span>
            <p className="font-medium text-foreground">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString(locale) : t('users.never')}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('users.groups_section')}</span>
            <p className="font-medium text-foreground">{userGroups.length}</p>
          </div>
        </div>
      </div>

      {/* Groups section */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">{t('users.groups_section')}</h2>
        <UserGroupsSection 
          userId={id}
          currentGroups={userGroups}
          availableGroups={availableGroups}
        />
      </div>
    </div>
  )
}
