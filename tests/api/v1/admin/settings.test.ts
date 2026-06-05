import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuthenticate } = vi.hoisted(() => {
  return { mockAuthenticate: vi.fn() }
})

vi.mock('@/lib/api/auth', () => ({
  authenticate: mockAuthenticate,
}))

const adminCtx = {
  supabase: {} as any,
  userId: 'admin-user-id',
  email: 'admin@test.com',
  groupId: 'test-group-id',
  role: 'admin' as const,
}

function authError() {
  return new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid Authorization header' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET /api/v1/admin/settings ───────────────────────────────────────────

describe('GET /api/v1/admin/settings', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
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

// ─── PUT /api/v1/admin/settings ───────────────────────────────────────────

describe('PUT /api/v1/admin/settings', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { PUT } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeLocales: ['es', 'en'], defaultLocale: 'es' }),
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 with empty body', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { PUT } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('returns 400 with missing activeLocales', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { PUT } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
  })

  it('returns 400 with invalid defaultLocale', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { PUT } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeLocales: ['es', 'en'], defaultLocale: 'xx' }),
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.message).toContain('defaultLocale')
  })

  it('returns 400 when defaultLocale not in activeLocales', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { PUT } = await import('@/app/api/v1/admin/settings/route')
    const req = new Request('http://localhost:3000/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeLocales: ['es'], defaultLocale: 'en' }),
    }) as any
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.message).toContain('defaultLocale')
  })

  it.skip('returns 200 with valid settings and admin auth', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})
