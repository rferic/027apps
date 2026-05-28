import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'any')
  if (auth instanceof Response) return auth

  return apiOk([])
}
