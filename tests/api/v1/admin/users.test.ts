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

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────

describe('GET /api/v1/admin/users', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { GET } = await import('@/app/api/v1/admin/users/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users') as any
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

  it.skip('filters by search query', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns pagination metadata in response', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})

// ─── GET /api/v1/admin/users/[id] ─────────────────────────────────────────

describe('GET /api/v1/admin/users/[id]', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { GET } = await import('@/app/api/v1/admin/users/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users/some-id') as any
    const res = await GET(req, { params: Promise.resolve({ id: 'some-id' }) })
    expect(res.status).toBe(401)
  })

  it.skip('returns 200 with valid admin auth and existing user', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 404 for non-existent user', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})

// ─── PUT /api/v1/admin/users/[id] ─────────────────────────────────────────

describe('PUT /api/v1/admin/users/[id]', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { PUT } = await import('@/app/api/v1/admin/users/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users/some-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    }) as any
    const res = await PUT(req, { params: Promise.resolve({ id: 'some-id' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when admin tries to modify themselves', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { PUT } = await import('@/app/api/v1/admin/users/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users/admin-user-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    }) as any
    const res = await PUT(req, { params: Promise.resolve({ id: 'admin-user-id' }) })
    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toBe('FORBIDDEN')
  })

  it('returns 400 with invalid JSON body', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { PUT } = await import('@/app/api/v1/admin/users/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users/other-user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }) as any
    const res = await PUT(req, { params: Promise.resolve({ id: 'other-user' }) })
    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('BAD_REQUEST')
  })

  it.skip('returns 200 with valid update and admin auth', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})

// ─── DELETE /api/v1/admin/users/[id] ──────────────────────────────────────

describe('DELETE /api/v1/admin/users/[id]', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { DELETE } = await import('@/app/api/v1/admin/users/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users/some-id', {
      method: 'DELETE',
    }) as any
    const res = await DELETE(req, { params: Promise.resolve({ id: 'some-id' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when admin tries to delete themselves', async () => {
    mockAuthenticate.mockResolvedValueOnce(adminCtx)
    const { DELETE } = await import('@/app/api/v1/admin/users/[id]/route')
    const req = new Request('http://localhost:3000/api/v1/admin/users/admin-user-id', {
      method: 'DELETE',
    }) as any
    const res = await DELETE(req, { params: Promise.resolve({ id: 'admin-user-id' }) })
    expect(res.status).toBe(403)
    const body: any = await res.json()
    expect(body.error).toBe('FORBIDDEN')
  })

  it.skip('returns 204 with valid admin auth and existing user', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })

  it.skip('returns 404 for non-existent user', async () => {
    // Requires real Supabase DB and valid admin JWT
    expect(true).toBe(true)
  })
})
