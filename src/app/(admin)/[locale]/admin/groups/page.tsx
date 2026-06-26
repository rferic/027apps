import Link from 'next/link'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createAdminClient, createAdminClientUntyped } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/helpers'
import { GroupsTable } from './GroupsTable'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AdminGroupsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireAdmin()

  const adminClient = createAdminClient()

  const { data: groups } = await adminClient
    .from('groups')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false })

  // Member counts per group
  const { data: memberCounts } = await adminClient
    .from('group_members')
    .select('group_id')

  const counts = new Map<string, number>()
  for (const m of memberCounts ?? []) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1)
  }

  // App access counts per group (private apps via group_app_access)
  const untypedClient = createAdminClientUntyped()
  const { data: appAccessCounts } = await untypedClient
    .from('group_app_access')
    .select('group_id')

  const appCounts = new Map<string, number>()
  for (const a of appAccessCounts ?? []) {
    appCounts.set(a.group_id, (appCounts.get(a.group_id) ?? 0) + 1)
  }

  const t = await getTranslations('admin')

  const groupCount = groups?.length ?? 0

  const mappedGroups = (groups ?? []).map(g => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    created_at: g.created_at,
    memberCount: counts.get(g.id) ?? 0,
    appCount: appCounts.get(g.id) ?? 0,
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('groups.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('groups.subtitle', { count: groupCount })}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/groups/new`}
          className="inline-flex items-center px-4 py-2 text-sm font-medium bg-foreground hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          {t('groups.new_group')}
        </Link>
      </div>

      <GroupsTable groups={mappedGroups} locale={locale} />
    </div>
  )
}
