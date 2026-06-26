import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import * as SecureStore from 'expo-secure-store'
import { locales } from '@/i18n/locales'
import { mobileKeys } from '@/i18n/missing-keys'

const STORAGE_KEY = '027apps_language'
const SUPPORTED_LNGS = ['en', 'es', 'it', 'ca', 'fr', 'de'] as const
export type SupportedLng = (typeof SUPPORTED_LNGS)[number]

function mergeResources() {
  const resources: Record<string, { translation: Record<string, unknown> }> = {}
  for (const lng of SUPPORTED_LNGS) {
    const webLng = lng as keyof typeof locales
    const mobileLng = lng as keyof typeof mobileKeys
    resources[lng] = {
      translation: {
        ...(locales[webLng] as Record<string, unknown>),
        ...(mobileKeys[mobileLng] as Record<string, unknown>),
      },
    }
  }
  return resources
}

export function getStoredLanguage(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEY)
}

export async function setStoredLanguage(lang: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, lang)
  await i18n.changeLanguage(lang)
}

function detectLanguage(): string {
  const deviceLang = Localization.getLocales()[0]?.languageCode
  if (deviceLang && SUPPORTED_LNGS.includes(deviceLang as SupportedLng)) {
    return deviceLang
  }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: mergeResources(),
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LNGS],
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
})

export default i18n
