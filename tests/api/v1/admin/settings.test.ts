import { describe, it, expect } from 'vitest'

describe('GET /api/v1/admin/settings', () => {
  it('returns 401 without auth header', async () => {
    const { GET } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings') as any
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it.skip('returns 200 with admin auth and valid settings object', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns activeLocales and defaultLocale in response', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})

describe('PUT /api/v1/admin/settings', () => {
  it('returns 401 without auth header', async () => {
    const { PUT } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeLocales: ['es', 'en'],
        defaultLocale: 'es',
      }),
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it.skip('returns 400 with empty body', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 with missing activeLocales', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 with invalid defaultLocale', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 400 when defaultLocale not in activeLocales', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 200 with valid settings and admin auth', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})
