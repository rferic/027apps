import { createApiClient, createApiAdminClient } from '@/lib/supabase/api'
import { createServerClient } from '@supabase/ssr'
import { apiError } from '@/lib/api/response'
import type { UseCaseContext, AuthLevel } from '@/lib/api/types'

async function authenticateFromCookies(req: Request): Promise<UseCaseContext | null> {
  try {
    const cookieHeader = req.headers.get('Cookie') ?? ''
    const cookies: Array<{ name: string; value: string }> = cookieHeader
      .split(';')
      .map(c => {
        const idx = c.indexOf('=')
        if (idx === -1) return null
        return { name: c.slice(0, idx).trim(), value: c.slice(idx + 1).trim() }
      })
      .filter((c): c is { name: string; value: string } => c !== null && c.name.length > 0)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookies,
          setAll: async () => {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createApiAdminClient()
    const { data: members } = await admin
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', user.id)

    if (!members || members.length === 0) return null

    const first = members[0]
    const isAdmin = members.some(m => m.role === 'admin')
    return {
      supabase,
      userId: user.id,
      email: user.email ?? undefined,
      groupId: first.group_id,
      role: isAdmin ? 'admin' : 'member',
    }
  } catch {
    return null
  }
}

export async function authenticate(
  req: Request,
  level: AuthLevel
): Promise<UseCaseContext | Response> {
  if (level === 'public') {
    const supabase = createApiAdminClient()
    const { data: group } = await supabase.from('groups').select('id').limit(1).maybeSingle()
    if (!group) return apiError('not_found', 'Group not configured', 404)
    return { supabase, groupId: group.id }
  }

  const authHeader = req.headers.get('Authorization')
  const apiKeyHeader = req.headers.get('X-API-Key')

  // Try JWT auth first
  if (level === 'jwt' || (level === 'any' && authHeader?.startsWith('Bearer '))) {
    if (authHeader?.startsWith('Bearer ')) {
      const result = await validateJwt(authHeader.slice(7))
      if (result instanceof Response && level === 'jwt') return result
      if (!(result instanceof Response)) return result
    }
    // Fallback to session cookies
    const sessionAuth = await authenticateFromCookies(req)
    if (sessionAuth) return sessionAuth
    return apiError('unauthorized', 'Missing or invalid Authorization header', 401)
  }

  // Try API key
  if (level === 'apikey' || (level === 'any' && apiKeyHeader)) {
    if (!apiKeyHeader) return apiError('unauthorized', 'Missing X-API-Key header', 401)
    return validateApiKey(apiKeyHeader)
  }

  // Fallback: try session cookies for any matching auth level
  const sessionAuth = await authenticateFromCookies(req)
  if (sessionAuth) return sessionAuth

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
