import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'
import { scanInstalledAppSlugs } from '@/lib/apps/scanner'
import { loadAppMessages, hasAppI18n } from '@/lib/apps/i18n'
import { cachedQuery } from '@/lib/cache'
import { promises as fs } from 'fs'
import path from 'path'

async function scanLocalAppSlugs(): Promise<string[]> {
  try {
    const appsDir = path.join(process.cwd(), 'apps')
    const entries = await fs.readdir(appsDir, { withFileTypes: true })
    const slugs: string[] = []
    for (const entry of entries) {
      if (entry.isDirectory() && await hasAppI18n(entry.name)) {
        slugs.push(entry.name)
      }
    }
    return slugs
  } catch {
    return []
  }
}

const getCachedMessages = cachedQuery(
  async (locale: string): Promise<Record<string, unknown>> => {
    const globalMessages = (await import(`./messages/${locale}.json`)).default as Record<string, unknown>

    let slugs: string[] = []
    try {
      slugs = await scanInstalledAppSlugs()
    } catch {
      // DB not available — fall back to filesystem scan
      slugs = await scanLocalAppSlugs()
    }

    let appMessages: Record<string, Record<string, unknown>> = {}
    if (slugs.length > 0) {
      const entries = await Promise.all(
        slugs.map(async (slug) => [slug, await loadAppMessages(slug, locale)] as const)
      )
      appMessages = Object.fromEntries(entries)
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
