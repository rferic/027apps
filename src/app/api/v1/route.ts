import { NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const GET = async (request: NextRequest) => {
  const ip = getClientIp(request.headers.get('x-forwarded-for'))
  const { allowed } = checkRateLimit(`health-v1:${ip}`, 120, 60_000)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    })
  }

  return Response.json(
    { version: 'v1', status: 'ok' },
    {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    }
  )
}
