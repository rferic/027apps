import { notFound, redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserGroups } from '@/lib/groups/context'
import AppProvider from '@/components/app-provider'
import AppTheme from '@/components/app-theme'
import { readManifest } from '@/lib/apps/manifest'
import { resolveAppConfig } from '@/lib/apps/config'
import { AppValidationError } from '@/types/apps'

const SLUG_RE = /^[a-z0-9-]+$/

import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  params: Promise<{ locale: string; slug: string }>
}

export default async function AppSlugLayout({ children, params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  if (!SLUG_RE.test(slug)) notFound()

  let manifest
  try {
    manifest = await readManifest(slug)
  } catch (err) {
    if (err instanceof AppValidationError) notFound()
    throw err
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Redirect to group-scoped URL so the view can resolve groupSlug
  const groups = await getUserGroups(user.id)
  if (groups.length === 0) notFound()
  redirect(`/${locale}/${groups[0].slug}/apps/${slug}`)
}
