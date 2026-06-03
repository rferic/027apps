'use client'

import { createContext, useContext } from 'react'
import type { AppManifest, ResolvedAppConfig } from '@/types/apps'

export interface AppContextValue {
  slug: string
  manifest: AppManifest
  config: ResolvedAppConfig
  groupId?: string
  groupSlug?: string
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext(): AppContextValue {
  return useContext(AppContext) ?? ({} as AppContextValue)
}
