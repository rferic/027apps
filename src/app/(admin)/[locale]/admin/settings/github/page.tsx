import { setRequestLocale, getTranslations } from 'next-intl/server'
import { getGitHubSettings } from './actions'
import { GitHubSettingsManager } from './GitHubSettingsManager'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function GitHubSettingsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('admin.settings.github')

  const settings = await getGitHubSettings()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>
      <GitHubSettingsManager initial={settings} />
    </div>
  )
}
