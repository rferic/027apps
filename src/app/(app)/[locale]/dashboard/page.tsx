import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserGroups } from '@/lib/groups/context'
import { Sparkles, Users, Package, ArrowRight } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

async function GroupCard({ group, locale }: { group: { id: string; name: string; slug: string; role: string }; locale: string }) {
  const adminClient = createAdminClient()
  
  const [membersRes, appsRes] = await Promise.all([
    adminClient.from('group_members').select('user_id', { count: 'exact', head: true }).eq('group_id', group.id),
    adminClient.from('group_app_access').select('app_slug', { count: 'exact', head: true }).eq('group_id', group.id),
  ])
  
  const memberCount = membersRes.count ?? 0
  const appCount = appsRes.count ?? 0

  const initials = group.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Link
      href={`/${locale}/${group.slug}/dashboard`}
      className="bg-white rounded-xl border border-slate-100 p-5 hover:border-slate-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-emerald-600">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{group.name}</h3>
          {group.role === 'admin' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 mt-0.5">
              Admin
            </span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
        <span className="flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          {appCount} {appCount === 1 ? 'app' : 'apps'}
        </span>
      </div>
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 h-28 animate-pulse" />
      ))}
    </div>
  )
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const groups = await getUserGroups(user.id)

  if (groups.length === 0) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('noGroups')}</h2>
          <p className="text-sm text-slate-400 max-w-sm">{t('noGroupsDesc')}</p>
        </div>
      </main>
    )
  }

  if (groups.length === 1) {
    // Single group: redirect directly to its dashboard
    redirect(`/${locale}/${groups[0].slug}/dashboard`)
  }

  // Multi-group: show group cards
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{t('yourGroups')}</h1>
        <p className="text-sm text-slate-400 mt-1">{t('selectGroup')}</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map(group => (
            <GroupCard key={group.id} group={group} locale={locale} />
          ))}
        </div>
      </Suspense>
    </main>
  )
}

export { DashboardSkeleton }
