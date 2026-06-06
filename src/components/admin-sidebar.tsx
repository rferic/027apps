'use client'
import Image from 'next/image'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  SlidersHorizontal,
  Key,
  FileText,
  X,
  Package,
  Building2,
  ListOrdered,
  BookOpen,
  Book,
  GitBranch,
} from 'lucide-react'
import { useAdminMobile } from './admin-mobile-context'

interface SidebarApp {
  slug: string
  name: string
  primaryColor: string
}

interface Props {
  locale: string
  initialCollapsed: boolean
  apps?: SidebarApp[]
}

const STORAGE_KEY = 'admin-sidebar-collapsed'

export function AdminSidebar({ locale, initialCollapsed, apps }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [usersOpen, setUsersOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()
  const t = useTranslations('admin.nav')
  const { mobileOpen, setMobileOpen } = useAdminMobile()

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      // Write to cookie (for SSR initial state) and localStorage (backwards compat)
      document.cookie = `${STORAGE_KEY}=${next};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  function handleMenuEnter(name: string) {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setHoveredMenu(name)
  }

  function handleMenuLeave() {
    hoverTimeout.current = setTimeout(() => setHoveredMenu(null), 150)
  }

  const base = `/${locale}/admin`

  function isActive(href: string) {
    return pathname === href
  }

  function isActivePrefix(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const linkCls = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
      isActive(href)
        ? 'bg-rose-50 text-rose-700'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`

  const subLinkCls = (href: string) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ml-4 ${
      isActive(href)
        ? 'bg-rose-50 text-rose-700 font-medium'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
    }`

  const collapsedLinkCls = (href: string) =>
    `flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer ${
      isActive(href)
        ? 'bg-rose-50 text-rose-700'
        : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
    }`

  const userSubItems = [
    { href: `${base}/users`, label: t('members'), icon: Users },
    { href: `${base}/admins`, label: t('admins'), icon: UserCog },
    { href: `${base}/invitations`, label: t('invitations'), icon: Mail },
  ]

  const settingsSubItems = [
    { href: `${base}/settings/api-keys`, label: t('api_keys'), icon: Key },
    { href: `${base}/settings/apps`, label: t('apps_order'), icon: ListOrdered },
    { href: `${base}/settings/general`, label: t('general'), icon: SlidersHorizontal },
    { href: `${base}/settings/github`, label: t('github'), icon: GitBranch },
  ]

  const isUsersSection = userSubItems.some((item) => isActivePrefix(item.href))
  const isSettingsSection = settingsSubItems.some((item) => isActivePrefix(item.href))

  // Auto-open sections on mount/remount when the active route belongs to them
  useEffect(() => {
    const id = setTimeout(() => {
      setUsersOpen(isUsersSection)
      setSettingsOpen(isSettingsSection)
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navContent = (forceExpanded = false) => {
    const isCollapsed = forceExpanded ? false : collapsed
    return (
      <>
        <nav className={`flex-1 p-2 space-y-0.5 pt-3 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
          {isCollapsed ? (
            <>
              {/* Dashboard */}
              <div
                className="relative"
                onMouseEnter={() => handleMenuEnter('dashboard')}
                onMouseLeave={handleMenuLeave}
              >
                <Link href={`${base}/dashboard`} className={collapsedLinkCls(`${base}/dashboard`)}>
                  <LayoutDashboard size={18} />
                </Link>
                {hoveredMenu === 'dashboard' && (
                  <div className="absolute left-full top-1 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                    {t('dashboard')}
                  </div>
                )}
              </div>

              {/* Apps */}
              <div
                className="relative"
                onMouseEnter={() => handleMenuEnter('apps')}
                onMouseLeave={handleMenuLeave}
              >
                <Link href={`${base}/apps`} className={collapsedLinkCls(`${base}/apps`)}>
                  <Package size={18} />
                </Link>
                {hoveredMenu === 'apps' && (
                  <div className="absolute left-full top-1 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                    {t('apps')}
                  </div>
                )}
              </div>

              {/* Installed apps in collapsed mode */}
              {apps && apps.length > 0 && apps.map(app => (
                <div
                  key={app.slug}
                  className="relative"
                  onMouseEnter={() => handleMenuEnter(`app_${app.slug}`)}
                  onMouseLeave={handleMenuLeave}
                >
                  <Link
                    href={`${base}/apps/${app.slug}`}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer ${
                      isActive(`${base}/apps/${app.slug}`)
                        ? 'bg-rose-50 text-rose-700'
                        : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Image unoptimized
                      src={`/api/apps/${app.slug}/logo`}
                      alt={app.name}
                      width={18}
                      height={18}
                      className="w-[18px] h-[18px] rounded"
                    />
                  </Link>
                  {hoveredMenu === `app_${app.slug}` && (
                    <div className="absolute left-full top-1 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                      {app.name}
                    </div>
                  )}
                </div>
              ))}

              {/* Groups */}
              <div
                className="relative"
                onMouseEnter={() => handleMenuEnter('groups')}
                onMouseLeave={handleMenuLeave}
              >
                <Link href={`${base}/groups`} className={collapsedLinkCls(`${base}/groups`)}>
                  <Building2 size={18} />
                </Link>
                {hoveredMenu === 'groups' && (
                  <div className="absolute left-full top-1 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                    {t('groups')}
                  </div>
                )}
              </div>

              {/* Users submenu */}
              <div
                className="relative"
                onMouseEnter={() => handleMenuEnter('users')}
                onMouseLeave={handleMenuLeave}
              >
                <button
                  type="button"
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer ${
                    isActive(`${base}/users`) || isActivePrefix(`${base}/users`) ? 'bg-rose-50 text-rose-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Users size={18} />
                </button>
                {hoveredMenu === 'users' && (
                  <div
                    className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-50"
                    onMouseEnter={() => handleMenuEnter('users')}
                    onMouseLeave={handleMenuLeave}
                  >
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {t('users')}
                    </p>
                    {userSubItems.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                          isActive(href) ? 'text-rose-700 bg-rose-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings submenu */}
              <div
                className="relative"
                onMouseEnter={() => handleMenuEnter('settings')}
                onMouseLeave={handleMenuLeave}
              >
                <button
                  type="button"
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer ${
                    isActive(`${base}/settings`) || isActivePrefix(`${base}/settings`) ? 'bg-rose-50 text-rose-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Settings size={18} />
                </button>
                {hoveredMenu === 'settings' && (
                  <div
                    className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-50"
                    onMouseEnter={() => handleMenuEnter('settings')}
                    onMouseLeave={handleMenuLeave}
                  >
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {t('settings')}
                    </p>
                    {settingsSubItems.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                          isActive(href) ? 'text-rose-700 bg-rose-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Dashboard */}
              <Link href={`${base}/dashboard`} className={linkCls(`${base}/dashboard`)}>
                <LayoutDashboard size={16} className="flex-shrink-0" />
                {t('dashboard')}
              </Link>

              {/* Apps */}
              <Link href={`${base}/apps`} className={linkCls(`${base}/apps`)}>
                <Package size={16} className="flex-shrink-0" />
                {t('apps')}
              </Link>

              {apps && apps.length > 0 && apps.map(app => (
                <Link
                  key={app.slug}
                  href={`${base}/apps/${app.slug}`}
                  className={linkCls(`${base}/apps/${app.slug}`)}
                >
                  <Image unoptimized
                    src={`/api/apps/${app.slug}/logo`}
                    alt={app.name}
                    width={16}
                    height={16}
                    className="w-4 h-4 rounded flex-shrink-0"
                  />
                  {app.name}
                </Link>
              ))}

              {/* Groups */}
              <Link href={`${base}/groups`} className={linkCls(`${base}/groups`)}>
                <Building2 size={16} className="flex-shrink-0" />
                {t('groups')}
              </Link>

              {/* Users */}
              <div>
                <button
                  type="button"
                  onClick={() => setUsersOpen((open) => !open)}
                  className={`cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(`${base}/users`) || isActivePrefix(`${base}/users`) ? 'text-rose-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Users size={16} className="flex-shrink-0" />
                  <span className="flex-1 text-left">{t('users')}</span>
                  {usersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {usersOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {userSubItems.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} className={subLinkCls(href)}>
                        <Icon size={14} className="flex-shrink-0" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings */}
              <div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((open) => !open)}
                  className={`cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(`${base}/settings`) || isActivePrefix(`${base}/settings`) ? 'text-rose-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Settings size={16} className="flex-shrink-0" />
                  <span className="flex-1 text-left">{t('settings')}</span>
                  {settingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {settingsOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {settingsSubItems.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} className={subLinkCls(href)}>
                        <Icon size={14} className="flex-shrink-0" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Documentation */}
          {isCollapsed ? (
            <div
              className="relative"
              onMouseEnter={() => handleMenuEnter('docs')}
              onMouseLeave={handleMenuLeave}
            >
              <button
                type="button"
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer text-gray-400 hover:text-gray-900 hover:bg-gray-100"
              >
                <BookOpen size={18} />
              </button>
              {hoveredMenu === 'docs' && (
                <div
                  className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-50"
                  onMouseEnter={() => handleMenuEnter('docs')}
                  onMouseLeave={handleMenuLeave}
                >
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t('docs')}
                  </p>
                  <a
                    href="/api-docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <FileText size={14} />
                    {t('api_docs')}
                  </a>
                  <a
                    href={`/${locale}/doc`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <Book size={14} />
                    {t('docs_home')}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setDocsOpen((open) => !open)}
                className="cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              >
                <BookOpen size={16} className="flex-shrink-0" />
                <span className="flex-1 text-left">{t('docs')}</span>
                {docsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {docsOpen && (
                <div className="mt-0.5 space-y-0.5">
                  <a
                    href="/api-docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={subLinkCls('/api-docs')}
                  >
                    <FileText size={14} className="flex-shrink-0" />
                    {t('api_docs')}
                  </a>
                  <a
                    href={`/${locale}/doc`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={subLinkCls('/docs')}
                  >
                    <Book size={14} className="flex-shrink-0" />
                    {t('docs_home')}
                  </a>
                </div>
              )}
            </div>
          )}
        </nav>

        {!forceExpanded && (
          <div className="p-2 border-t border-gray-100">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="cursor-pointer w-full flex items-center justify-center h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex bg-white flex-col transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        } flex-shrink-0 border-r border-gray-200`}
      >
        {navContent()}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="relative z-50 w-64 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{t('menu')}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            {navContent(true)}
          </aside>
        </div>
      )}
    </>
  )
}
