import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { getNotificationPrefs } from '@/lib/push/prefs'
import { NOTIFICATION_TYPES } from '@/lib/push/types'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const prefs = await getNotificationPrefs(auth.userId!)

  return apiOk({
    global_enabled: prefs.global_enabled,
    types: prefs.types,
    all_types: Object.values(NOTIFICATION_TYPES),
  })
}

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  let body: { global_enabled?: boolean; types?: Record<string, boolean> }
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON', 400)
  }

  const db = createAdminClientUntyped()

  const { data: existing } = await db
    .from('notification_prefs')
    .select('global_enabled, prefs')
    .eq('user_id', auth.userId!)
    .maybeSingle()

  const currentPrefs = (existing as { prefs?: Record<string, boolean> } | null)?.prefs ?? {}

  const mergedTypes = {
    ...currentPrefs,
    ...(body.types ?? {}),
  }

  const { error } = await db
    .from('notification_prefs')
    .upsert(
      {
        user_id: auth.userId!,
        global_enabled: body.global_enabled ?? (existing as { global_enabled?: boolean } | null)?.global_enabled ?? true,
        prefs: mergedTypes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  return apiOk({ success: true })
}
