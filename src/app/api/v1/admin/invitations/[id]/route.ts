import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiError } from '@/lib/api/response'
import { deleteInvitation } from '@/lib/use-cases/invitations'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
  const result = await deleteInvitation(id)
  if (result.error) return apiError('not_found', 'Invitation not found', 404)

  return new Response(null, { status: 204 })
}
