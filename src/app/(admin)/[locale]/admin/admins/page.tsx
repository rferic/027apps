import { setRequestLocale, getTranslations } from 'next-intl/server'
import { getAdminUserList } from '@/lib/use-cases/admin/users'
import { getUserWithRole } from '@/lib/auth/helpers'
import { getGroupSettings } from '@/lib/use-cases/settings'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminUserTable } from '@/components/admin-user-table'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AdminAdminsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.admins')

  const adminClient = createAdminClient()

  const [users, currentUser, settings, groupMembersResult] = await Promise.all([
    getAdminUserList(),
    getUserWithRole(),
    getGroupSettings(),
    adminClient.from('group_members').select('user_id'),
  ])

  const admins = users.filter((user) => user.role === 'admin')

  const groupCounts = new Map<string, number>()
  for (const gm of (groupMembersResult.data ?? [])) {
    groupCounts.set(gm.user_id, (groupCounts.get(gm.user_id) ?? 0) + 1)
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{admins.length === 1 ? t('subtitle', { count: admins.length }) : t('subtitlePlural', { count: admins.length })}</p>
      </div>
      <AdminUserTable users={admins} currentUserId={currentUser!.userId} locale={locale} availableLocales={settings.activeLocales} groupCounts={groupCounts} />
    </main>
  )
}
