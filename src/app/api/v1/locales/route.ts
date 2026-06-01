import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk } from '@/lib/api/response'

// NOTE: locale fallback uses English as default. Per-group default comes from
// group_settings.default_locale when configured.
const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  it: 'Italian',
  ca: 'Catalan',
  fr: 'French',
  de: 'German',
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'public')
  if (auth instanceof Response) return auth

  const { data: settings } = await auth.supabase
    .from('group_settings')
    .select('active_locales, default_locale')
    .eq('group_id', auth.groupId)
    .maybeSingle()

  if (!settings || !settings.active_locales) {
    return apiOk([{ code: 'en', name: 'English', is_default: true }])
  }

  const locales = (settings.active_locales as string[]).map((code) => ({
    code,
    name: LOCALE_NAMES[code] ?? code,
    is_default: code === settings.default_locale,
  }))

  return apiOk(locales)
}
