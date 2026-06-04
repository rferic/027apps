import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createApiAdminClient } from '@/lib/supabase/api'
import { ALL_LOCALES } from '@/lib/use-cases/settings'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('display_name, avatar_url, locale')
    .eq('id', auth.userId!)
    .maybeSingle()

  return apiOk({
    id: auth.userId!,
    email: auth.email ?? '',
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    locale: profile?.locale ?? null,
    role: auth.role!,
    group_id: auth.groupId,
  })
}

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return apiError('invalid_body', 'Request body must be a JSON object', 400)
  }

  const { display_name, locale, avatar_url } = body as Record<string, unknown>

  // Validate locale if provided
  if (locale !== undefined) {
    if (typeof locale !== 'string' || !(ALL_LOCALES as readonly string[]).includes(locale)) {
      return apiError('invalid_locale', `Locale must be one of: ${ALL_LOCALES.join(', ')}`, 400)
    }
  }

  // Validate display_name if provided
  if (display_name !== undefined && typeof display_name !== 'string') {
    return apiError('invalid_display_name', 'display_name must be a string', 400)
  }

  // Validate avatar_url if provided
  if (avatar_url !== undefined && typeof avatar_url !== 'string') {
    return apiError('invalid_avatar_url', 'avatar_url must be a string', 400)
  }

  const admin = createApiAdminClient()
  const updateData: Record<string, unknown> = {}

  if (display_name !== undefined) updateData.display_name = display_name
  if (locale !== undefined) updateData.locale = locale
  if (avatar_url !== undefined) updateData.avatar_url = avatar_url

  if (Object.keys(updateData).length === 0) {
    return apiError('no_fields', 'At least one field (display_name, locale, avatar_url) must be provided', 400)
  }

  // Upsert: use userId as key
  const { data: updated, error } = await admin
    .from('profiles')
    .upsert({ id: auth.userId!, ...updateData, updated_at: new Date().toISOString() })
    .select('display_name, avatar_url, locale')
    .single()

  if (error || !updated) {
    return apiError('update_failed', error?.message ?? 'Failed to update profile', 500)
  }

  return apiOk({
    id: auth.userId!,
    email: auth.email ?? '',
    display_name: updated.display_name ?? null,
    avatar_url: updated.avatar_url ?? null,
    locale: updated.locale ?? null,
    role: auth.role!,
    group_id: auth.groupId,
  })
}
