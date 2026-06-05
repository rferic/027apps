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

// ─── GET /api/v1/admin/api-keys ───────────────────────────────────────────

describe('GET /api/v1/admin/api-keys', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { GET } = await import('@/app/api/v1/admin/api-keys/route')
    const req = new Request('http://localhost:3000/api/v1/admin/api-keys') as any
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it.skip('returns 200 with admin auth and default pagination', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 200 with custom pagination params', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns pagination metadata in response', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})

// ─── POST /api/v1/admin/api-keys ──────────────────────────────────────────

describe('POST /api/v1/admin/api-keys', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { POST } = await import('@/app/api/v1/admin/api-keys/route')
    const req = new Request('http://localhost:3000/api/v1/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Key' }),
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 with empty body', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { POST } = await import('@/app/api/v1/admin/api-keys/route')
    const req = new Request('http://localhost:3000/api/v1/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('returns 400 with invalid JSON body', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { POST } = await import('@/app/api/v1/admin/api-keys/route')
    const req = new Request('http://localhost:3000/api/v1/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('returns 400 when name is missing', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { POST } = await import('@/app/api/v1/admin/api-keys/route')
    const req = new Request('http://localhost:3000/api/v1/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as any
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
  })

  it.skip('returns 201 with valid api key data and admin auth', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})

// ─── DELETE /api/v1/admin/api-keys/[id] ───────────────────────────────────

describe('DELETE /api/v1/admin/api-keys/[id]', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { DELETE } = await import('@/app/api/v1/admin/api-keys/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/api-keys/some-id', {
      method: 'DELETE',
    }) as any
    const res = await DELETE(req, { params: Promise.resolve({ id: 'some-id' }) })
    expect(res.status).toBe(401)
  })

  it.skip('returns 204 with valid admin auth and existing key', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 404 for non-existent API key', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})
