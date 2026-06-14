import { withTiming } from '@/lib/api/response'

export const GET = withTiming(
  () => new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
  'health'
)
