import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import {
  getAdminUser,
  changeUserRole,
  updateUserProfile,
  blockUser,
  unblockUser,
  deleteAdminUser,
} from '@/lib/use-cases/admin/users'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
  const user = await getAdminUser(id)
  if (!user) return apiError('not_found', 'User not found', 404)

  return apiOk(user)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id: userId } = await params
  if (userId === auth.userId) return apiError('FORBIDDEN', 'Cannot modify yourself', 403)

  let body: unknown
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }
  if (typeof body !== 'object' || body === null) return apiError('BAD_REQUEST', 'Body must be an object', 400)

  const { role, displayName, email, locale, blocked } = body as Record<string, unknown>

  // Role change
  if (typeof role === 'string' && (role === 'admin' || role === 'member')) {
    const result = await changeUserRole(userId, role)
    if (result.error) return apiError('ROLE_UPDATE_FAILED', result.error, 400)
  }

  // Profile update
  if (typeof displayName === 'string' || typeof email === 'string' || typeof locale === 'string') {
    const result = await updateUserProfile(userId, {
      displayName: (typeof displayName === 'string' ? displayName : '') as string,
      email: (typeof email === 'string' ? email : '') as string,
      ...(typeof locale === 'string' ? { locale } : {}),
    })
    if (result.error) return apiError('PROFILE_UPDATE_FAILED', result.error, 400)
  }

  // Block/unblock
  if (blocked === true) {
    const result = await blockUser(userId)
    if (result.error) return apiError('BLOCK_FAILED', result.error, 400)
  } else if (blocked === false) {
    const result = await unblockUser(userId)
    if (result.error) return apiError('UNBLOCK_FAILED', result.error, 400)
  }

  const updatedUser = await getAdminUser(userId)
  return apiOk(updatedUser)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id: userId } = await params
  if (userId === auth.userId) return apiError('FORBIDDEN', 'Cannot delete yourself', 403)

  const result = await deleteAdminUser(userId)
  if (result.error) return apiError('DELETE_FAILED', result.error, 400)

  return new Response(null, { status: 204 })
}
