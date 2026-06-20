import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { routing } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppHeader } from '@/components/app-header'
import { AppSubNav } from '@/components/app-sub-nav'
import { AppFooter } from '@/components/app-footer'
import { BlockedOverlay } from '@/components/blocked-overlay'
import { Toaster } from '@/components/ui/sonner'
import { AppShell, type NavItem } from '@/components/app-shell'
import { getUserGroups } from '@/lib/groups/context'
import { readManifest } from '@/lib/apps/manifest'
import { getActiveApps, getGroupAppAccess, getGroupMemberCounts } from '@/lib/layout-cache'
import { ThemeProvider } from '@/components/theme-provider'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!routing.locales.includes(locale as typeof routing.locales[number])) notFound()
  const messages = await getMessages()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auth guard for all (app) routes except login
  const h = await headers()
  const rawPath = h.get('x-invoke-path') || h.get('next-url') || ''

  // Extraer solo el pathname (next-url devuelve URL completa, x-invoke-path solo path)
  let pathname = rawPath
  if (rawPath.startsWith('http')) {
    try { pathname = new URL(rawPath).pathname } catch { pathname = '' }
  }
  if (!user && pathname && !pathname.endsWith('/login') && !pathname.endsWith('/recover') && !pathname.endsWith('/update-password')) {
    redirect(`/${locale}/login`)
  }

  let displayName = ''
  let isAdmin = false
  let isBlocked = false
  let userGroups: { id: string; name: string; slug: string; role: string }[] = []

  const adminClient = createAdminClient()

  if (user) {
    const [profileResult, groups, authResult] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user.id).single(),
      getUserGroups(user.id),
      adminClient.auth.admin.getUserById(user.id),
    ])
    displayName = profileResult.data?.display_name ?? user.email?.split('@')[0] ?? ''
    userGroups = groups
    isAdmin = groups.some(g => g.role === 'admin')
    const bannedUntil = authResult.data?.user?.banned_until ?? null
    isBlocked = !!bannedUntil && new Date(bannedUntil) > new Date()
  }

  // Enrich userGroups with member counts for the group switcher
  let userGroupsWithCounts = userGroups
  if (userGroups.length > 1) {
    const groupIds = userGroups.map(g => g.id)
    const counts = await getGroupMemberCounts(groupIds)
    userGroupsWithCounts = userGroups.map(g => ({
      ...g,
      memberCount: counts[g.id] || 0,
    }))
  }

  // Extraer el group-slug: 1) URL (vía middleware x-invoke-path), 2) cookie last_group, 3) primer grupo
  const segments = pathname.split('/').filter(Boolean)
  // pathname: "/en/mi-familia/dashboard" → segments: ["en", "mi-familia", "dashboard"]
  // segments[0] = locale, segments[1] = potential group-slug
  const slugFromUrl =
    segments.length >= 2 && segments[1] !== 'login' && segments[1] !== 'profile' && segments[1] !== 'recover' && segments[1] !== 'update-password'
      ? segments[1]
      : null

  const cookieStore = await cookies()
  const cookieGroupSlug = cookieStore.get('last_group')?.value ?? null

  // Prioridad: slug en URL → slug en cookie → primer grupo del usuario
  const currentGroupSlug =
    (slugFromUrl && userGroups.some(g => g.slug === slugFromUrl) ? slugFromUrl : null) ??
    (cookieGroupSlug && userGroups.some(g => g.slug === cookieGroupSlug) ? cookieGroupSlug : null) ??
    userGroups[0]?.slug ??
    null

  // Sync the last_group cookie whenever the group is resolved (from URL or fallback)
  if (currentGroupSlug && currentGroupSlug !== cookieGroupSlug) {
    cookieStore.set('last_group', currentGroupSlug, {
      path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax',
    })
  }

  // Usar el grupo correspondiente para cargar las apps instaladas
  const currentGroup = currentGroupSlug
    ? userGroups.find(g => g.slug === currentGroupSlug)
    : null

  const activeApps = currentGroup ? await getActiveApps() : []

  // Load group_app_access to determine which private apps this group can access
  let privateAppSlugs = new Set<string>()
  if (currentGroup && activeApps && activeApps.some(a => a.visibility === 'private')) {
    const accessRows = await getGroupAppAccess(currentGroup.id)
    privateAppSlugs = new Set(accessRows)
  }

  const navItems: NavItem[] = []
  const groupApps: { slug: string; name: string; logo: string; primaryColor: string }[] = []

  if (currentGroupSlug && activeApps) {
    for (const app of activeApps) {
      // Skip private apps the group doesn't have access to
      if (app.visibility === 'private' && !privateAppSlugs.has(app.slug)) continue
      try {
        const manifest = await readManifest(app.slug)
        groupApps.push({ slug: app.slug, name: manifest.name, logo: manifest.logo, primaryColor: manifest.primaryColor })
        if (manifest.views.public) {
          navItems.push({
            slug: app.slug,
            label: manifest.name,
            href: `/${locale}/${currentGroupSlug}/apps/${app.slug}`,
            primaryColor: manifest.primaryColor,
          })
        }
      } catch { /* skip apps with invalid manifests */ }
    }
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <Toaster position="bottom-right" />
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
        {user && (
          <AppHeader
            locale={locale}
            displayName={displayName}
            isAdmin={isAdmin}
            userGroups={userGroupsWithCounts}
            currentGroupSlug={currentGroupSlug}
            currentGroupId={currentGroup?.id}
            groupApps={groupApps}
          />
        )}
        {user && <AppSubNav locale={locale} currentGroupSlug={currentGroupSlug} groupApps={groupApps} />}
        {user && isBlocked && <BlockedOverlay locale={locale} showSignOut />}
        {user ? (
          <AppShell navItems={navItems} locale={locale} currentGroupSlug={currentGroupSlug}>
            {children}
          </AppShell>
        ) : (
          children
        )}
        <AppFooter locale={locale} />
      </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}
