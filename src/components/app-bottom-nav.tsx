'use client'
import Image from 'next/image'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Home, LayoutGrid } from 'lucide-react'

function AppIcon({ slug, label }: { slug: string; label: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: 'var(--app-primary, #6B7280)' }}>{slug.slice(0, 2).toUpperCase()}</div>
  }
  return (
    <Image unoptimized
      src={`/api/apps/${slug}/logo`}
      alt={label}
      className="w-5 h-5 rounded"
      onError={() => setFailed(true)}
    />
  )
}

export interface NavItem {
  slug: string
  label: string
  href: string
  primaryColor?: string
}

interface Props {
  navItems: NavItem[]
  locale: string
  currentGroupSlug?: string | null
}

function NavLink({ href, label, icon: Icon, active, onClick, color }: { href: string; label: string; icon: React.ElementType; active: boolean; onClick?: () => void; color?: string }) {
  const activeStyle = color
    ? { color, backgroundColor: `${color}14` }
    : {}
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? (color ? '' : 'text-emerald-600 bg-emerald-50') : 'text-slate-500 hover:text-slate-700'
      }`}
      style={active ? activeStyle : undefined}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  )
}

export function AppBottomNav({ navItems, locale, currentGroupSlug }: Props) {
  const t = useTranslations('app')
  const pathname = usePathname()
  const [overflowOpen, setOverflowOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Derivar group-slug de la URL: /es/mi-familia/dashboard → mi-familia
  // Fallback al prop si no se puede extraer de la URL
  const segments = pathname.split('/').filter(Boolean)
  const slugFromUrl =
    segments.length >= 2 && segments[1] !== 'login' && segments[1] !== 'profile'
      ? segments[1]
      : null
  const effectiveSlug = slugFromUrl ?? currentGroupSlug ?? null

  useEffect(() => {
    if (!overflowOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [overflowOpen])

  const homeHref = effectiveSlug
    ? `/${locale}/${effectiveSlug}/dashboard`
    : `/${locale}/dashboard`

  const MAX_DYNAMIC = 4
  const visibleDynamic = navItems.slice(0, MAX_DYNAMIC)
  const overflowItems = navItems.slice(MAX_DYNAMIC)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 py-1 z-20">
      {overflowOpen && overflowItems.length > 0 && (
        <div
          ref={panelRef}
          className="absolute bottom-full left-0 right-0 bg-white border-t border-slate-100 shadow-lg rounded-t-xl p-4 z-30"
        >
          <div className="flex flex-wrap gap-2">
            {overflowItems.map(({ slug, label, href, primaryColor }) => {
              const active = pathname.startsWith(href)
              const activeStyle = primaryColor ? { color: primaryColor, backgroundColor: `${primaryColor}14` } : undefined
              return (
                <Link
                  key={slug}
                  href={href}
                  onClick={() => setOverflowOpen(false)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active ? (primaryColor ? '' : 'text-emerald-600 bg-emerald-50') : 'text-slate-500 hover:text-slate-700'
                  }`}
                  style={active ? activeStyle : undefined}
                >
                  <AppIcon slug={slug} label={label} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex items-center justify-around max-w-md mx-auto">
        <NavLink href={homeHref} label={t('nav.home')} icon={Home} active={pathname === homeHref} />
        {visibleDynamic.map(({ slug, label, href, primaryColor }) => {
          const active = pathname.startsWith(href)
          const activeStyle = primaryColor ? { color: primaryColor, backgroundColor: `${primaryColor}14` } : undefined
          return (
            <Link key={slug} href={href} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              active ? (primaryColor ? '' : 'text-emerald-600 bg-emerald-50') : 'text-slate-500 hover:text-slate-700'
            }`} style={active ? activeStyle : undefined}>
              <AppIcon slug={slug} label={label} />
              <span>{label}</span>
            </Link>
          )
        })}
        {overflowItems.length > 0 && (
          <button
            onClick={() => setOverflowOpen(prev => !prev)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              overflowOpen ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span>{t('nav.more')}</span>
          </button>
        )}
      </div>
    </nav>
  )
}
