import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, withTiming } from '@/lib/api/response'
import { getGroupSettings } from '@/lib/use-cases/settings'

export const GET = withTiming(async function GET(_req: NextRequest) {
  const auth = await authenticate(_req, 'jwt')
  if (auth instanceof Response) return auth

  const settings = await getGroupSettings()

  return apiOk({
    active_locales: settings.activeLocales,
    default_locale: settings.defaultLocale,
  })
})
