import { describe, it, expect } from 'vitest'

describe('GET /api/v1/shared/profile', () => {
  it('returns 401 without auth header', async () => {
    const { GET } = await import('@/app/api/v1/shared/profile/route')
    const req = new Request('http://localhost:3000/api/v1/shared/profile') as any
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it.skip('returns 200 with authenticated user and valid profile shape', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns id, email, display_name, avatar_url, locale, role, group_id', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })
})

describe('PUT /api/v1/shared/profile', () => {
  it('returns 401 without auth header', async () => {
    const { PUT } = await import('@/app/api/v1/shared/profile/route')
    const req = new Request('http://localhost:3000/api/v1/shared/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'New Name' }),
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it.skip('returns 400 with invalid JSON body', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 with empty body', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 with invalid locale', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 with non-string display_name', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 with non-string avatar_url', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })

  it.skip('returns 200 with valid profile update and authenticated user', async () => {
    // Requires real Supabase DB and valid JWT
    expect(true).toBe(true)
  })
})
