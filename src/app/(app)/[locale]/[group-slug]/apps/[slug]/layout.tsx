import { notFound, redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, createAdminClientUntyped } from '@/lib/supabase/admin'
import { readManifest } from '@/lib/apps/manifest'
import { resolveAppConfig } from '@/lib/apps/config'
import { resolveGroupContext } from '@/lib/groups/context'
import { AppValidationError } from '@/types/apps'
import AppProvider from '@/components/app-provider'
import AppTheme from '@/components/app-theme'

const SLUG_RE = /^[a-z0-9-]+$/

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  params: Promise<{ locale: string; 'group-slug': string; slug: string }>
}

export default async function AppSlugLayout({ children, params }: Props) {
  const { locale, 'group-slug': groupSlug, slug } = await params
  setRequestLocale(locale)

  if (!SLUG_RE.test(slug)) notFound()

  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Resolve group
  const groupCtx = await resolveGroupContext(groupSlug, user.id)
  if (!groupCtx) notFound()

  let manifest
  try {
    manifest = await readManifest(slug)
  } catch (err) {
    if (err instanceof AppValidationError) notFound()
    throw err
  }

  const adminClient = createAdminClient()
  const { data: installedApp } = await adminClient
    .from('installed_apps')
    .select('status, visibility, config')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!installedApp) notFound()

  // Check group_app_access for private apps
  if (installedApp.visibility === 'private') {
    const untyped = createAdminClientUntyped()
    const { data: access } = await untyped
      .from('group_app_access')
      .select('id')
      .eq('app_slug', slug)
      .eq('group_id', groupCtx.id)
      .single()
    if (!access) notFound()
  }

  const resolvedConfig = resolveAppConfig(manifest, (installedApp.config as Record<string, unknown>) ?? {})

  return (
    <AppTheme primaryColor={manifest.primaryColor} secondaryColor={manifest.secondaryColor}>
      <AppProvider slug={slug} manifest={manifest} config={resolvedConfig} groupId={groupCtx.id} groupSlug={groupSlug}>
        <div className="bg-card border border-border" style={{ maxWidth: 1024, margin: '0 auto' }}>
          {children}
        </div>
      </AppProvider>
    </AppTheme>
  )
}
