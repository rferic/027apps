import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { UserDropdown } from './user-dropdown'
import { HamburgerButton } from './admin-hamburger-button'
import { getGroupSettings } from '@/lib/use-cases/settings'

interface Props {
  displayName: string
  locale: string
}

export async function AdminHeader({ displayName, locale }: Props) {
  const [t, settings] = await Promise.all([
    getTranslations('admin'),
    getGroupSettings(),
  ])

  return (
    <header className="h-14 bg-white px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <HamburgerButton />
        <Link href={`/${locale}/admin/dashboard`} className="flex items-center gap-2">
          <Image src="/logo-icon.svg" alt="027Apps" width={22} height={22} priority />
          <span className="font-bold text-gray-900 text-sm">{t('title')}</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <UserDropdown locale={locale} displayName={displayName} profileHref={`/${locale}/admin/profile`} activeLocales={settings.activeLocales} />
      </div>
    </header>
  )
}
