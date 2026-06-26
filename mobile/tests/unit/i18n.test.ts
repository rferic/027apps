import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock expo-secure-store (getItemAsync needs to be accessible)
// Already mocked in setup.ts — we just need to import

vi.mock('expo-localization', () => ({
  getLocales: vi.fn(() => [{ languageCode: 'en' }]),
}))

vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: vi.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve()
    }),
    deleteItemAsync: vi.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
  }
})

vi.mock('@/i18n/locales', () => ({
  locales: {
    en: { common: { hello: 'Hello' } },
    es: { common: { hello: 'Hola' } },
    it: { common: { hello: 'Ciao' } },
    ca: { common: { hello: 'Hola' } },
    fr: { common: { hello: 'Bonjour' } },
    de: { common: { hello: 'Hallo' } },
  },
}))

vi.mock('@/i18n/missing-keys', () => ({
  mobileKeys: {
    en: { mobile: { welcome: { title: '027Apps' } } },
    es: { mobile: { welcome: { title: '027Apps' } } },
    it: { mobile: { welcome: { title: '027Apps' } } },
    ca: { mobile: { welcome: { title: '027Apps' } } },
    fr: { mobile: { welcome: { title: '027Apps' } } },
    de: { mobile: { welcome: { title: '027Apps' } } },
  },
}))

import { getStoredLanguage, setStoredLanguage } from '@/lib/i18n'
import i18n from '@/lib/i18n'

describe('i18n', () => {
  describe('initialization', () => {
    it('should support 6 languages', () => {
      expect(i18n.options.supportedLngs).toContain('en')
      expect(i18n.options.supportedLngs).toContain('es')
      expect(i18n.options.supportedLngs).toContain('it')
      expect(i18n.options.supportedLngs).toContain('ca')
      expect(i18n.options.supportedLngs).toContain('fr')
      expect(i18n.options.supportedLngs).toContain('de')
    })

    it('should have english as fallback language', () => {
      const fallback = i18n.options.fallbackLng
      const fallbackValue = Array.isArray(fallback) ? fallback[0] : fallback
      expect(fallbackValue).toBe('en')
    })
  })

  describe('getStoredLanguage', () => {
    it('should return null when no language stored', async () => {
      const lang = await getStoredLanguage()
      expect(lang).toBeNull()
    })
  })

  describe('setStoredLanguage', () => {
    it('should save and change language', async () => {
      await setStoredLanguage('es')
      const lang = await getStoredLanguage()
      expect(lang).toBe('es')
    })
  })
})
