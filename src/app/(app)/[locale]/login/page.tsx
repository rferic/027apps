import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { AppLoginForm } from '@/components/auth/AppLoginForm'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getGroupSettings } from '@/lib/use-cases/settings'
import { getUserGroups, getLastGroupCookie } from '@/lib/groups/context'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ reset?: string }> }

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const { reset } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const groups = await getUserGroups(user.id)

    // Intentar redirigir al último grupo visitado (cookie last_group)
    if (groups.length > 0) {
      const lastGroupSlug = await getLastGroupCookie()
      const targetGroup = lastGroupSlug
        ? groups.find(g => g.slug === lastGroupSlug)
        : null

      if (targetGroup) {
        redirect(`/${locale}/${targetGroup.slug}/dashboard`)
      }
      // Fallback al primer grupo si la cookie no coincide o no existe
      redirect(`/${locale}/${groups[0].slug}/dashboard`)
    }
    redirect(`/${locale}/dashboard`)
  }

  const [t, settings] = await Promise.all([
    getTranslations('auth'),
    getGroupSettings(),
  ])

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <LocaleSwitcher currentLocale={locale} locales={settings.activeLocales} targetPath="login" />
        </div>

        <div className="flex flex-col items-center mb-8">
          <Image src="/logo-icon.svg" alt="027Apps" width={56} height={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">027Apps</h1>
          <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
        </div>

        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <AppLoginForm locale={locale} showResetSuccess={reset === 'success'} />
        </div>
      </div>
    </div>
  )
}
