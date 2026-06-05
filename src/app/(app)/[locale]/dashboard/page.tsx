import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getUserGroups } from '@/lib/groups/context'
import { Sparkles } from 'lucide-react'

type Props = { params: Promise<{ locale: string }> }

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
    redirect(`/${locale}/${groups[0].slug}/dashboard`)
  }

  // Multi-group: use last_group cookie, fallback to first group
  const cookieStore = await cookies()
  const lastGroupSlug = cookieStore.get('last_group')?.value ?? null

  const lastGroup = lastGroupSlug
    ? groups.find(g => g.slug === lastGroupSlug)
    : null

  if (lastGroup) {
    redirect(`/${locale}/${lastGroup.slug}/dashboard`)
  }

  // No valid cookie — redirect to first group
  redirect(`/${locale}/${groups[0].slug}/dashboard`)
}
