import { setRequestLocale, getTranslations } from 'next-intl/server'
import { getGroupSettings } from '@/lib/use-cases/settings'
import { SettingsForm } from './SettingsForm'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function SettingsGeneralPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.settings')
  const tg = await getTranslations('admin.settings.general')
  const settings = await getGroupSettings()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{tg('subtitle')}</p>
      </div>
      <SettingsForm
        activeLocales={settings.activeLocales}
        defaultLocale={settings.defaultLocale}
      />
    </div>
  )
}
