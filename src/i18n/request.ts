import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'
import { scanInstalledAppSlugs } from '@/lib/apps/scanner'
import { loadAppMessages } from '@/lib/apps/i18n'
import { cachedQuery } from '@/lib/cache'

const getCachedMessages = cachedQuery(
  async (locale: string): Promise<Record<string, unknown>> => {
    const globalMessages = (await import(`./messages/${locale}.json`)).default as Record<string, unknown>

    let appMessages: Record<string, Record<string, unknown>> = {}
    try {
      const slugs = await scanInstalledAppSlugs()
      const entries = await Promise.all(
        slugs.map(async (slug) => [slug, await loadAppMessages(slug, locale)] as const)
      )
      appMessages = Object.fromEntries(entries)
    } catch {
      // DB not available (e.g. build time) — continue without app messages
    }

    return {
      ...globalMessages,
      apps: {
        ...(typeof globalMessages.apps === 'object' && globalMessages.apps !== null ? globalMessages.apps : {}),
        ...appMessages,
      },
    } as Record<string, unknown>
  },
  ['i18n-messages'],
  { revalidate: 3600, tags: ['i18n-messages'] }
)

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
    locale = routing.defaultLocale
  }

  const messages = await getCachedMessages(locale)

  return {
    locale,
    messages,
  }
})
