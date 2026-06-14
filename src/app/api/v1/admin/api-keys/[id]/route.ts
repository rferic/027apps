import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiError, withTiming } from '@/lib/api/response'
import { revokeApiKey } from '@/lib/use-cases/api-keys/revoke-api-key'
import { UseCaseError } from '@/lib/use-cases/types'

export const DELETE = withTiming(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params

  try {
    await revokeApiKey(id, auth.groupId)
  } catch (e) {
    if (e instanceof UseCaseError) {
      const status = e.code === 'not_found' ? 404 : 500
      return apiError(e.code, e.message, status)
    }
    return apiError('INTERNAL_ERROR', 'Failed to revoke API key', 500)
  }

  return new Response(null, { status: 204 })
})
