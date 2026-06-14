import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { getAdminInvitationListPaginated, createInvitation } from '@/lib/use-cases/invitations'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export const GET = withTiming(async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const { data, total } = await getAdminInvitationListPaginated(page, limit)
  const totalPages = Math.ceil(total / limit)

  return apiOk({
    data,
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
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return apiError('VALIDATION_ERROR', 'Title is required', 400)

  const role = b.role === 'admin' ? 'admin' : 'member'
  const email = typeof b.email === 'string' ? b.email : null
  const expiresAt = typeof b.expiresAt === 'string' ? b.expiresAt : null
  const locale = typeof b.locale === 'string' ? b.locale : 'es'
  const groupIds = Array.isArray(b.groupIds) && (b.groupIds as string[]).length > 0
    ? (b.groupIds as string[])
    : [auth.groupId]

  const result = await createInvitation({
    title,
    role,
    email,
    expiresAt,
    invitedBy: auth.userId!,
    groupIds,
    locale,
  })

  if ('error' in result) return apiError('creation_failed', result.error, 400)

  return apiOk({ token: result.token }, 201)
})
