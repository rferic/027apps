import { apiOk, withTiming } from '@/lib/api/response'

export const GET = withTiming(() => apiOk({ version: 'v1', status: 'ok' }))
