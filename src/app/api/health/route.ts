import { NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const GET = async (request: NextRequest) => {
  const ip = getClientIp(request.headers.get('x-forwarded-for'))
  const { allowed } = checkRateLimit(`health:${ip}`, 120, 60_000)
  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    })
  }

  return new Response('ok', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=30, s-maxage=60',
    },
  })
}
