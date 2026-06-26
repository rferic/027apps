import type { ComponentType } from 'react'

export interface MobileModule {
  slug: string
  name: string
  description: string
  icon?: string
  primaryColor?: string
  secondaryColor?: string
  View: ComponentType<Record<string, never>>
}

const moduleRegistry = new Map<string, MobileModule>()

export function registerModule(module: MobileModule): void {
  moduleRegistry.set(module.slug, module)
}

export function getModule(slug: string): MobileModule | undefined {
  return moduleRegistry.get(slug)
}

export function getAllModules(): MobileModule[] {
  return Array.from(moduleRegistry.values())
}

export function isModuleRegistered(slug: string): boolean {
  return moduleRegistry.has(slug)
}
