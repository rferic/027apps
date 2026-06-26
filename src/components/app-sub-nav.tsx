'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Home } from 'lucide-react'

interface AppInfo {
  slug: string
  name: string
  logo: string
  primaryColor: string
}

interface Props {
  locale: string
  currentGroupSlug: string | null
  groupApps: AppInfo[]
}

export function AppSubNav({ locale, currentGroupSlug, groupApps }: Props) {
  const pathname = usePathname()

  if (!currentGroupSlug) return null

  // Use the group slug from the current URL path, falling back to the prop
  const segments = pathname.split('/').filter(Boolean)
  const slugFromUrl = segments.length >= 2 ? segments[1] : null
  const effectiveSlug = slugFromUrl ?? currentGroupSlug

  const isActive = (slug: string) => pathname.includes(`/apps/${slug}`)

  return (
    <div className="hidden md:flex items-center gap-1 px-4 sm:px-6 h-10 bg-background border-b border-border overflow-x-auto">
      <Link
        href={`/${locale}/${effectiveSlug}/dashboard`}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors flex-shrink-0"
      >
        <Home size={13} />
        Home
      </Link>
      <span className="text-border mx-0.5 flex-shrink-0">|</span>
      {groupApps.map(app => {
        const active = isActive(app.slug)
        return (
          <Link
            key={app.slug}
            href={`/${locale}/${effectiveSlug}/apps/${app.slug}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex-shrink-0 ${
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
            style={active ? { backgroundColor: app.primaryColor + '15', color: app.primaryColor } : {}}
          >
            <div
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: app.primaryColor + '20' }}
            >
              <Image src={`/api/apps/${app.slug}/logo`} alt="" width={12} height={12} className="opacity-70" unoptimized />
            </div>
            {app.name}
          </Link>
        )
      })}
    </div>
  )
}
