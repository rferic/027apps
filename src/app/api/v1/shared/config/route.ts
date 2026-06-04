import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk } from '@/lib/api/response'
import { getGroupSettings } from '@/lib/use-cases/settings'

export async function GET(_req: NextRequest) {
  const auth = await authenticate(_req, 'jwt')
  if (auth instanceof Response) return auth

  const settings = await getGroupSettings()

  return apiOk({
    active_locales: settings.activeLocales,
    default_locale: settings.defaultLocale,
  })
}
