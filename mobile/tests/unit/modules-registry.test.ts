import { describe, it, expect, beforeEach } from 'vitest'
import { registerModule, getModule, getAllModules, isModuleRegistered } from '@/lib/modules/registry'
import type { MobileModule } from '@/lib/modules/registry'

function makeModule(slug: string): MobileModule {
  return {
    slug,
    name: `Module ${slug}`,
    description: `Description for ${slug}`,
    View: () => null,
  }
}

describe('modules registry', () => {
  // Clear internal registry by re-importing? No — the Map is module-scoped.
  // Instead we use unique slugs per describe to avoid cross-test pollution.
  beforeEach(() => {
    // The registry is a module-level Map, so state persists between tests.
    // We clean up by removing known test slugs.
    for (const mod of getAllModules()) {
      // Can't unregister directly — this is a known limitation.
      // Tests use unique slugs to compensate.
    }
  })

  describe('registerModule', () => {
    it('should add a module', () => {
      const mod = makeModule('test-module-1')
      registerModule(mod)
      expect(getModule('test-module-1')).toBe(mod)
    })

    it('should overwrite an existing module with the same slug', () => {
      const mod1 = makeModule('test-module-2')
      const mod2 = { ...makeModule('test-module-2'), name: 'Updated' }
      registerModule(mod1)
      registerModule(mod2)
      expect(getModule('test-module-2')?.name).toBe('Updated')
    })
  })

  describe('getModule', () => {
    it('should return undefined for unregistered slug', () => {
      expect(getModule('nonexistent')).toBeUndefined()
    })

    it('should return the module for a registered slug', () => {
      const mod = makeModule('test-module-3')
      registerModule(mod)
      expect(getModule('test-module-3')).toBe(mod)
    })
  })

  describe('getAllModules', () => {
    it('should return all registered modules', () => {
      const mod4 = makeModule('test-module-4')
      const mod5 = makeModule('test-module-5')
      registerModule(mod4)
      registerModule(mod5)

      const all = getAllModules()
      expect(all).toContain(mod4)
      expect(all).toContain(mod5)
    })
  })

  describe('isModuleRegistered', () => {
    it('should return true for registered module', () => {
      registerModule(makeModule('test-module-6'))
      expect(isModuleRegistered('test-module-6')).toBe(true)
    })

    it('should return false for unregistered module', () => {
      expect(isModuleRegistered('test-module-7')).toBe(false)
    })
  })
})
