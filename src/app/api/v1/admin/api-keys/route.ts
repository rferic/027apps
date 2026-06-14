import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { listApiKeys } from '@/lib/use-cases/api-keys/list-api-keys'
import { createApiKey } from '@/lib/use-cases/api-keys/create-api-key'
import { UseCaseError } from '@/lib/use-cases/types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export const GET = withTiming(async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  let allKeys
  try {
    allKeys = await listApiKeys(auth.groupId)
  } catch (e) {
    if (e instanceof UseCaseError) return apiError(e.code, e.message, 500)
    return apiError('INTERNAL_ERROR', 'Failed to list API keys', 500)
  }

  const total = allKeys.length
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const paginated = allKeys.slice(offset, offset + limit)

  return apiOk({
    data: paginated,
    pagination: { page, limit, total, total_pages: totalPages },
  })
})

export const POST = withTiming(async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: unknown
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const b = body as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name) return apiError('VALIDATION_ERROR', 'Name is required', 400)

  const scope = b.scope === 'user' ? 'user' : 'group'
  const userId = scope === 'user' ? (typeof b.userId === 'string' ? b.userId : undefined) : undefined

  try {
    const result = await createApiKey(auth.groupId, auth.userId!, { name, scope, userId })
    return apiOk({ key: result.key, rawKey: result.rawKey }, 201)
  } catch (e) {
    if (e instanceof UseCaseError) return apiError(e.code, e.message, 400)
    return apiError('INTERNAL_ERROR', 'Failed to create API key', 500)
  }
})
