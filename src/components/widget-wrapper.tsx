'use client'

import { type ReactNode } from 'react'
import AppProvider from '@/components/app-provider'
import type { AppManifest, ResolvedAppConfig } from '@/types/apps'

export function WidgetWrapper({ children, slug, manifest, config, groupId, groupSlug }: {
  children: ReactNode; slug: string; manifest: AppManifest; config: ResolvedAppConfig; groupId: string; groupSlug: string;
}) {
  return (
    <AppProvider slug={slug} manifest={manifest} config={config} groupId={groupId} groupSlug={groupSlug}>
      {children}
    </AppProvider>
  )
}
