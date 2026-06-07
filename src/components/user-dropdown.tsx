'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signOut, updateLocale } from '@/lib/auth/actions'

interface Props {
  locale: string
  displayName: string
  /** Href for the "Edit profile" link. Defaults to /{locale}/profile */
  profileHref?: string
  isAdmin?: boolean
  /** Subset of locales to show for in-dropdown language switching */
  activeLocales?: string[]
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export function UserDropdown({ locale, displayName, profileHref, isAdmin, activeLocales }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('user')
  const tNav = useTranslations('nav')
  const [open, setOpen] = useState(false)
  const [localePending, startLocaleTransition] = useTransition()
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer flex items-center gap-2 hover:opacity-75 transition-opacity"
      >
        <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">{initials(displayName)}</span>
        </div>
        <span className="text-sm text-slate-600 hidden sm:block">{displayName}</span>
        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-slate-100 shadow-lg py-1 z-50">
          <Link
            href={profileHref ?? `/${locale}/profile`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            {t('editProfile')}
          </Link>
          {profileHref?.includes('/admin/') ? (
            <Link
              href={`/${locale}/`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {tNav('website')}
            </Link>
          ) : isAdmin && (
            <Link
              href={`/${locale}/admin/dashboard`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {tNav('backoffice')}
            </Link>
          )}
          <hr className="my-1 border-slate-100" />
          <div className="px-4 py-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Language</p>
            <div className="flex flex-wrap gap-1">
              {(activeLocales ?? ['en', 'es', 'fr', 'de', 'it', 'ca']).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  disabled={localePending}
                  onClick={() => {
                    if (loc === locale) return
                    startLocaleTransition(async () => {
                      await updateLocale(loc)
                      document.cookie = `preferred-locale=${loc};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
                      const pathAfterLocale = pathname.split('/').slice(2).join('/')
                      router.push(`/${loc}/${pathAfterLocale}`)
                    })
                  }}
                  className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-all disabled:opacity-50 cursor-pointer ${
                    loc === locale
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <hr className="my-1 border-slate-100" />
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await signOut(locale) })}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            {pending ? '…' : t('signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
