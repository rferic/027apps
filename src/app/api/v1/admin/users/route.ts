import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { getAdminUserList } from '@/lib/use-cases/admin/users'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export const GET = withTiming(async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
  const search = url.searchParams.get('search')?.toLowerCase()

  let users = await getAdminUserList()

  if (search) {
    users = users.filter(
      u => u.email.toLowerCase().includes(search) || u.displayName.toLowerCase().includes(search)
    )
  }

  const total = users.length
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const paginated = users.slice(offset, offset + limit)

  return apiOk({
    data: paginated,
    pagination: { page, limit, total, total_pages: totalPages },
  })
})
