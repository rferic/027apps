import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { getGroupSettings, updateGroupSettings, ALL_LOCALES } from '@/lib/use-cases/settings'

export const GET = withTiming(async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const settings = await getGroupSettings()
  return apiOk(settings)
})

export const PUT = withTiming(async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: unknown
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const b = body as Record<string, unknown>
  const activeLocales: string[] = Array.isArray(b.activeLocales)
    ? (b.activeLocales as string[]).filter(l => (ALL_LOCALES as readonly string[]).includes(l))
    : []

  if (activeLocales.length === 0) {
    return apiError('VALIDATION_ERROR', 'activeLocales must contain at least one valid locale', 400)
  }

  const defaultLocale = typeof b.defaultLocale === 'string' ? b.defaultLocale : ''
  if (!(ALL_LOCALES as readonly string[]).includes(defaultLocale)) {
    return apiError('VALIDATION_ERROR', 'defaultLocale is not a valid locale', 400)
  }
  if (!activeLocales.includes(defaultLocale)) {
    return apiError('VALIDATION_ERROR', 'defaultLocale must be in activeLocales', 400)
  }

  await updateGroupSettings({ activeLocales, defaultLocale })
  const settings = await getGroupSettings()
  return apiOk(settings)
})
