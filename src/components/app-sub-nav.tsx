'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home } from 'lucide-react'

interface AppInfo {
  slug: string
  name: string
}

interface Props {
  locale: string
  currentGroupSlug: string | null
  groupApps: AppInfo[]
}

export function AppSubNav({ locale, currentGroupSlug, groupApps }: Props) {
  const pathname = usePathname()

  if (!currentGroupSlug) return null

  const isActive = (slug: string) => pathname.includes(`/apps/${slug}`)

  return (
    <div className="hidden md:flex items-center gap-1 px-4 sm:px-6 h-10 bg-white border-b border-slate-100">
      <Link
        href={`/${locale}/${currentGroupSlug}/dashboard`}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
      >
        <Home size={13} />
        Home
      </Link>
      <span className="text-slate-200 mx-0.5">|</span>
      {groupApps.map(app => (
        <Link
          key={app.slug}
          href={`/${locale}/${currentGroupSlug}/apps/${app.slug}`}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            isActive(app.slug)
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          {app.name}
        </Link>
      ))}
    </div>
  )
}
