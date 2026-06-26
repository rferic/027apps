import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getUserWithRole } from '@/lib/auth/helpers'
import { getGroupSettings } from '@/lib/use-cases/settings'
import { ProfileForm } from '@/components/profile-form'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.profile')

  const [userWithRole, settings] = await Promise.all([
    getUserWithRole(),
    getGroupSettings(),
  ])
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('display_name, locale').eq('id', userWithRole?.userId ?? '').single()

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <ProfileForm
        displayName={profile?.display_name ?? ''}
        locale={profile?.locale ?? 'es'}
        availableLocales={settings.activeLocales}
        showLocale
      />
    </main>
  )
}
