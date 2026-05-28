import { describe, it, expect } from 'vitest'

describe('GET /api/v1', () => {
  it('returns version and status', async () => {
    const { GET } = await import('@/app/api/v1/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ version: 'v1', status: 'ok' })
  })
})
