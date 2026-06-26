'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { updateLocale } from '@/lib/auth/actions'
import { routing } from '@/i18n/routing'

type Locale = typeof routing.locales[number]

interface Props {
  currentLocale: string
  /** Subset of locales to show. Defaults to all routing locales. */
  locales?: string[]
  /** Explicit path segment after the locale. If omitted, infers from current URL. */
  targetPath?: string
  /** Persist locale preference to the database (use in authenticated contexts). */
  saveToDb?: boolean
  /** Whether to navigate after switching locale. Default true. Set false for pages without locale in URL (e.g. admin). */
  navigate?: boolean
}

export function LocaleSwitcher({ currentLocale, locales, targetPath, saveToDb = false, navigate = true }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState(currentLocale)

  const visibleLocales = locales ?? [...routing.locales]

  function switchLocale(locale: Locale) {
    if (locale === selected || pending) return

    setSelected(locale)
    startTransition(async () => {
      if (saveToDb) {
        await updateLocale(locale)
      } else {
        document.cookie = `preferred-locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
      }
      if (navigate) {
        const pathAfterLocale = targetPath ?? pathname.split('/').slice(2).join('/')
        router.push(`/${locale}/${pathAfterLocale}`)
      }
    })
  }

  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
      {visibleLocales.map((loc) => (
        <button
          key={loc}
          type="button"
          disabled={pending}
          onClick={() => switchLocale(loc as Locale)}
          className={`cursor-pointer text-[11px] font-semibold px-2 py-1 rounded-md transition-all disabled:opacity-50 ${
            selected === loc
              ? 'bg-card text-slate-800 shadow-sm'
              : 'text-muted-foreground hover:text-slate-600'
          }`}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
