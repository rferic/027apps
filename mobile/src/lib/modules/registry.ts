import type { ComponentType } from 'react'
import Constants from 'expo-constants'

export interface MobileModule {
  slug: string
  name: string
  description: string
  icon?: string
  primaryColor?: string
  secondaryColor?: string
  beta?: boolean
  View: ComponentType<Record<string, never>>
}

const moduleRegistry = new Map<string, MobileModule>()

export function registerModule(module: MobileModule): void {
  moduleRegistry.set(module.slug, module)
}

export function getModule(slug: string): MobileModule | undefined {
  const mod = moduleRegistry.get(slug)
  if (!mod) return undefined
  if (isBetaVariant() && mod.beta) return mod
  if (!isBetaVariant() && mod.beta) return undefined
  return mod
}

export function getAllModules(): MobileModule[] {
  const beta = isBetaVariant()
  return Array.from(moduleRegistry.values()).filter((m) => {
    if (beta && m.beta) return true
    if (!beta && m.beta) return false
    return true
  })
}

export function isModuleRegistered(slug: string): boolean {
  return getModule(slug) !== undefined
}

function isBetaVariant(): boolean {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined
  return extra?.appVariant === 'beta'
}
