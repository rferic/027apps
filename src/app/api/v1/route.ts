import { apiOk } from '@/lib/api/response'

export const GET = () => apiOk({ version: 'v1', status: 'ok' })
