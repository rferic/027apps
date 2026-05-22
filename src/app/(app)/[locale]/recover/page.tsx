import { getTranslations, setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { RecoverForm } from './RecoverForm'

type Props = { params: Promise<{ locale: string }> }

export default async function RecoverPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth')

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-icon.svg" alt="027Apps" width={56} height={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">027Apps</h1>
          <p className="text-sm text-slate-400 mt-1">{t('recover_title')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <RecoverForm locale={locale} />
        </div>

        <div className="text-center mt-4">
          <Link
            href={`/${locale}/login`}
            className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4"
          >
            {t('recover_back_to_login')}
          </Link>
        </div>
      </div>
    </div>
  )
}
