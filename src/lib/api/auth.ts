import { createApiClient, createApiAdminClient } from '@/lib/supabase/api'
import { apiError } from '@/lib/api/response'
import type { UseCaseContext, AuthLevel } from '@/lib/api/types'

export async function authenticate(
  req: Request,
  level: AuthLevel
): Promise<UseCaseContext | Response> {
  if (level === 'public') {
    // Sin auth — groupId desde la única instancia del grupo
    const supabase = createApiAdminClient()
    const { data: group } = await supabase.from('groups').select('id').limit(1).maybeSingle()
    if (!group) return apiError('not_found', 'Group not configured', 404)
    return { supabase, groupId: group.id }
  }

  const authHeader = req.headers.get('Authorization')
  const apiKeyHeader = req.headers.get('X-API-Key')

  if (level === 'jwt' || (level === 'any' && authHeader)) {
    if (!authHeader?.startsWith('Bearer ')) {
      return apiError('unauthorized', 'Missing or invalid Authorization header', 401)
    }
    return validateJwt(authHeader.slice(7))
  }

  if (level === 'apikey' || (level === 'any' && apiKeyHeader)) {
    if (!apiKeyHeader) {
      return apiError('unauthorized', 'Missing X-API-Key header', 401)
    }
    return validateApiKey(apiKeyHeader)
  }

  return apiError('unauthorized', 'Authentication required', 401)
}

async function validateJwt(token: string): Promise<UseCaseContext | Response> {
  const supabase = createApiClient(token)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return apiError('unauthorized', 'Invalid or expired token', 401)
  }

  const admin = createApiAdminClient()
  const { data: members } = await admin
    .from('group_members')
    .select('group_id, role')
    .eq('user_id', user.id)

  if (!members || members.length === 0) {
    return apiError('forbidden', 'User is not a member of any group', 403)
  }

  // Usar el primer grupo por defecto (el cliente debe especificar group_id si necesita otro)
  const first = members[0]
  const isAdmin = members.some(m => m.role === 'admin')

  return {
    supabase,
    userId: user.id,
    email: user.email ?? undefined,
    groupId: first.group_id,
    role: isAdmin ? 'admin' : 'member',
  }
}

async function validateApiKey(key: string): Promise<UseCaseContext | Response> {
  const hash = await sha256(key)
  const admin = createApiAdminClient()

  const { data: apiKey } = await admin
    .from('api_keys')
    .select('group_id, user_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle()

  if (!apiKey) return apiError('unauthorized', 'Invalid API key', 401)
  if (apiKey.revoked_at) return apiError('unauthorized', 'API key has been revoked', 401)

  // Actualizar last_used_at (best-effort, no bloquear si falla)
  void Promise.resolve(
    admin.from('api_keys').update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', hash)
  ).catch(() => {})

  return {
    supabase: admin,
    groupId: apiKey.group_id,
    userId: apiKey.user_id ?? undefined,
  }
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}
