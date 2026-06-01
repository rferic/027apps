import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWithRole } from '@/lib/auth/helpers'
import { readManifest } from '@/lib/apps/manifest'
import { AdminHeader } from '@/components/admin-header'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminMobileProvider } from '@/components/admin-mobile-context'
import { AdminOverflowReset } from '@/components/admin-overflow-reset'
import { Toaster } from '@/components/ui/sonner'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params
  if (!routing.locales.includes(locale as typeof routing.locales[number])) notFound()
  setRequestLocale(locale)

  const result = await getUserWithRole()

  if (!result || result.role !== 'admin') {
    redirect(`/${locale}/`)
  }

  const cookieStore = await cookies()
  // Default to expanded; only collapse when cookie is explicitly 'true'
  const sidebarCollapsed = cookieStore.get('admin-sidebar-collapsed')?.value === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, locale')
    .eq('id', result.userId)
    .single()
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Admin'
  const messages = await getMessages()

  // Load installed apps with admin views for sidebar navigation
  const adminClient = createAdminClient()
  const { data: installedApps } = await adminClient
    .from('installed_apps')
    .select('slug')
    .eq('status', 'active')
  const sidebarApps: { slug: string; name: string; primaryColor: string }[] = []
  if (installedApps) {
    for (const app of installedApps) {
      try {
        const manifest = await readManifest(app.slug)
        if (manifest.views.admin) {
          sidebarApps.push({ slug: app.slug, name: manifest.name, primaryColor: manifest.primaryColor })
        }
      } catch {
        // skip apps with invalid manifests
      }
    }
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <AdminMobileProvider>
        <AdminOverflowReset />
        <Toaster theme="light" position="bottom-right" />
        <div className="min-h-screen bg-gray-100 flex flex-col isolate">
          <AdminHeader displayName={displayName} locale={locale} />
          <div className="flex flex-1 overflow-hidden">
            <AdminSidebar locale={locale} initialCollapsed={sidebarCollapsed} apps={sidebarApps} />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </AdminMobileProvider>
    </NextIntlClientProvider>
  )
}
