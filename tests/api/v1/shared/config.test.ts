import { describe, it, expect } from 'vitest'

describe('GET /api/v1/shared/config', () => {
  it('returns 401 without auth header', async () => {
    const { GET } = await import('@/app/api/v1/shared/config/route')
    const req = new Request('http://localhost:3000/api/v1/shared/config') as any
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it.skip('returns 200 with authenticated user and valid config shape', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns active_locales and default_locale in response', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })
})
