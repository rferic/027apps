import { apiOk, withTiming } from '@/lib/api/response'

export const GET = withTiming(() => {
  const res = apiOk({ version: 'v1', status: 'ok' })
  res.headers.set('X-Test', 'works')
  res.headers.set('Server-Timing', 'test;dur=42.0')
  return res
})
