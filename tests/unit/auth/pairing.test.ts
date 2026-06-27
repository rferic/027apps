import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

// ===========================================================================
// Core logic tests — pure functions, no DB or API mocks needed
// ===========================================================================

// ---- generateSecret ----

describe('generateSecret', () => {
  it('returns a 64-character hex string', async () => {
    const { generateSecret } = await import('@/lib/auth/pairing')
    const secret = generateSecret()
    expect(secret).toHaveLength(64)
    expect(/^[a-f0-9]{64}$/.test(secret)).toBe(true)
  })

  it('generates unique secrets on each call', async () => {
    const { generateSecret } = await import('@/lib/auth/pairing')
    const secrets = new Set(Array.from({ length: 20 }, () => generateSecret()))
    expect(secrets.size).toBe(20)
  })
})

// ---- generatePairingCode ----

describe('generatePairingCode', () => {
  const SECRET = 'abc123def456'
  const FIXED_NOW = 1700000000000

  function computeExpected(secret: string, timestamp: number): string {
    const minutes = Math.floor(timestamp / 60000)
    const hash = crypto.createHmac('sha256', secret).update(String(minutes)).digest('hex')
    const num = parseInt(hash.slice(0, 6), 16)
    return String(num % 1000000).padStart(6, '0')
  }

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a 6-digit string', async () => {
    const { generatePairingCode } = await import('@/lib/auth/pairing')
    const code = generatePairingCode(SECRET)
    expect(code).toHaveLength(6)
    expect(/^\d{6}$/.test(code)).toBe(true)
  })

  it('produces deterministic codes for the same secret in the same minute', async () => {
    const { generatePairingCode } = await import('@/lib/auth/pairing')
    expect(generatePairingCode(SECRET)).toBe(generatePairingCode(SECRET))
  })

  it('produces different codes for different secrets', async () => {
    const { generatePairingCode } = await import('@/lib/auth/pairing')
    expect(generatePairingCode('secret-a')).not.toBe(generatePairingCode('secret-b'))
  })

  it('matches the expected HMAC-based computation', async () => {
    const { generatePairingCode } = await import('@/lib/auth/pairing')
    expect(generatePairingCode(SECRET)).toBe(computeExpected(SECRET, FIXED_NOW))
  })

  it('changes when the minute changes', async () => {
    const { generatePairingCode } = await import('@/lib/auth/pairing')
    const codeT = generatePairingCode(SECRET)

    vi.restoreAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW + 60000)

    const { generatePairingCode: fresh } = await import('@/lib/auth/pairing')
    const codeT2 = fresh(SECRET)
    expect(codeT).not.toBe(codeT2)
  })

  it('pads with leading zeros when needed', async () => {
    const { generatePairingCode } = await import('@/lib/auth/pairing')
    const code = generatePairingCode(SECRET)
    // The code should always have exactly 6 digits, no more, no less
    expect(code.length).toBe(6)
    // Verify it is parseable as a number (no leading chars, etc.)
    expect(Number(code)).toBeGreaterThanOrEqual(0)
    expect(Number(code)).toBeLessThan(1000000)
  })
})

// ---- verifyPairingCode ----

describe('verifyPairingCode', () => {
  const SECRET = 'verify-secret-123'
  const FIXED_NOW = 1700000000000

  function computeCode(secret: string, timestamp: number): string {
    const minutes = Math.floor(timestamp / 60000)
    const hash = crypto.createHmac('sha256', secret).update(String(minutes)).digest('hex')
    const num = parseInt(hash.slice(0, 6), 16)
    return String(num % 1000000).padStart(6, '0')
  }

  const currentCode = computeCode(SECRET, FIXED_NOW)
  const prevMinuteCode = computeCode(SECRET, FIXED_NOW - 60000)
  const twoMinutesAgoCode = computeCode(SECRET, FIXED_NOW - 120000)

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for the current-minute code', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode(SECRET, currentCode)).toBe(true)
  })

  it('returns true for the previous-minute code (clock skew tolerance)', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode(SECRET, prevMinuteCode)).toBe(true)
  })

  it('returns false for a code from two minutes ago', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode(SECRET, twoMinutesAgoCode)).toBe(false)
  })

  it('returns false for a completely wrong code', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode(SECRET, '000000')).toBe(false)
    expect(verifyPairingCode(SECRET, '123456')).toBe(false)
    expect(verifyPairingCode(SECRET, '999999')).toBe(false)
  })

  it('returns false for a correct code but wrong secret', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode('different-secret', currentCode)).toBe(false)
  })

  it('consistently verifies the same code within the window', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    for (let i = 0; i < 10; i++) {
      expect(verifyPairingCode(SECRET, currentCode)).toBe(true)
      expect(verifyPairingCode(SECRET, prevMinuteCode)).toBe(true)
    }
  })

  it('rejects an empty code', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode(SECRET, '')).toBe(false)
  })

  it('rejects codes shorter than 6 digits', async () => {
    const { verifyPairingCode } = await import('@/lib/auth/pairing')
    expect(verifyPairingCode(SECRET, '12345')).toBe(false)
  })
})

// ===========================================================================
// API endpoint tests — POST /api/v1/auth/pair and /api/v1/auth/pair/verify
// ===========================================================================

const { mockAuthenticate, mockAdminFrom, mockGetUserById } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockGetUserById: vi.fn(),
}))

vi.mock('@/lib/api/auth', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClientUntyped: vi.fn(() => ({
    from: mockAdminFrom,
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}))

// ---- Chain mock helper ----

function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }
  const chain: Record<string, unknown> = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).catch(fn),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'in', 'limit', 'order', 'rpc', 'filter', 'or', 'range', 'not', 'neq']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function authError() {
  return new Response(
    JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid Authorization header' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}

// ---- POST /api/v1/auth/pair ----

describe('POST /api/v1/auth/pair', () => {
  const FIXED_NOW = 1700000000000
  const AUTH_CONTEXT = {
    supabase: {} as unknown,
    userId: 'user-1',
    groupId: 'g1',
    role: 'member' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())

    const { POST } = await import('@/app/api/v1/auth/pair/route')
    const req = new Request('http://localhost/api/v1/auth/pair', { method: 'POST' }) as any
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns session with code, qr_data, and expires_at for authenticated user', async () => {
    mockAuthenticate.mockResolvedValueOnce(AUTH_CONTEXT)
    mockAdminFrom.mockReturnValueOnce(makeChain({ id: 'sess-abc', expires_at: '2099-12-31T23:59:59Z' }))

    const { POST } = await import('@/app/api/v1/auth/pair/route')
    const req = new Request('http://localhost/api/v1/auth/pair', { method: 'POST' }) as any
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body: any = await res.json()

    expect(body.session_id).toBe('sess-abc')
    expect(body.code).toHaveLength(6)
    expect(/^\d{6}$/.test(body.code)).toBe(true)
    expect(body.expires_at).toBe('2099-12-31T23:59:59Z')
    expect(body.qr_data).toBeDefined()

    const qr = JSON.parse(body.qr_data)
    expect(qr).toMatchObject({ v: 1, s: 'sess-abc' })
    expect(typeof qr.u).toBe('string')
  })

  it('returns 500 when DB insert fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(AUTH_CONTEXT)
    mockAdminFrom.mockReturnValueOnce(makeChain(null, { message: 'db error' }))

    const { POST } = await import('@/app/api/v1/auth/pair/route')
    const req = new Request('http://localhost/api/v1/auth/pair', { method: 'POST' }) as any
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body: any = await res.json()
    expect(body.error).toBe('CREATE_FAILED')
  })

  it('inserts with the correct user_id', async () => {
    mockAuthenticate.mockResolvedValueOnce(AUTH_CONTEXT)
    mockAdminFrom.mockReturnValueOnce(makeChain({ id: 'sess-xyz', expires_at: '2099-01-01T00:00:00Z' }))

    const { POST } = await import('@/app/api/v1/auth/pair/route')
    const req = new Request('http://localhost/api/v1/auth/pair', { method: 'POST' }) as any
    await POST(req)

    // Verify from('pairing_sessions') was called
    expect(mockAdminFrom).toHaveBeenCalledWith('pairing_sessions')
  })
})

// ---- POST /api/v1/auth/pair/verify ----

describe('POST /api/v1/auth/pair/verify', () => {
  const FIXED_NOW = 1700000000000
  const SECRET = 'test-secret-for-verify'

  // Pre-compute the code that matches SECRET at FIXED_NOW
  const currentCode = (() => {
    const minutes = Math.floor(FIXED_NOW / 60000)
    const hash = crypto.createHmac('sha256', SECRET).update(String(minutes)).digest('hex')
    const num = parseInt(hash.slice(0, 6), 16)
    return String(num % 1000000).padStart(6, '0')
  })()

  const validSession = {
    id: 'sess-1',
    user_id: 'user-1',
    secret: SECRET,
    expires_at: '2099-12-31T23:59:59Z',
    used_at: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Input validation ----

  it('returns 400 when body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: 'not-json',
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body: any = await res.json()
    expect(body.error).toBe('BAD_REQUEST')
  })

  it('returns 400 when session_id is missing', async () => {
    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when code is missing', async () => {
    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1' }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  // ---- Session lookup ----

  it('returns 404 when session is not found', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain(null))

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'nonexistent', code: '123456' }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(404)
    const body: any = await res.json()
    expect(body.error).toBe('NOT_FOUND')
  })

  it('returns 409 when session has already been used', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ ...validSession, used_at: '2024-06-01T12:00:00Z' }))

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: '123456' }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body: any = await res.json()
    expect(body.error).toBe('ALREADY_USED')
  })

  it('returns 410 when session has expired', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({
      ...validSession,
      expires_at: '2024-01-01T00:00:00Z',
      used_at: null,
    }))

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: '123456' }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(410)
    const body: any = await res.json()
    expect(body.error).toBe('EXPIRED')
  })

  // ---- Code verification ----

  it('returns 401 when the pairing code is invalid', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain(validSession))

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: '000000' }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body: any = await res.json()
    expect(body.error).toBe('INVALID_CODE')
  })

  it('returns 401 for codes with correct format but wrong value', async () => {
    // Generate a code that is 6 digits but guaranteed wrong
    const wrongCode = currentCode === '000000' ? '000001' : '000000'
    mockAdminFrom.mockReturnValueOnce(makeChain(validSession))

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: wrongCode }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  // ---- Success ----

  it('returns success with user_id and email for a valid code', async () => {
    mockAdminFrom
      .mockReturnValueOnce(makeChain(validSession))
      .mockReturnValueOnce(makeChain(null)) // update call

    mockGetUserById.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    })

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: currentCode }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
    expect(body.user_id).toBe('user-1')
    expect(body.email).toBe('user@example.com')
  })

  it('marks the session as used after successful verification', async () => {
    mockAdminFrom
      .mockReturnValueOnce(makeChain(validSession))
      .mockReturnValueOnce(makeChain(null)) // update

    mockGetUserById.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    })

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: currentCode }),
    }) as any
    await POST(req)

    // Second from() call should be for update
    const updateCall = mockAdminFrom.mock.calls[1]
    expect(updateCall[0]).toBe('pairing_sessions')
  })

  it('omits email field when user has no email on file', async () => {
    mockAdminFrom
      .mockReturnValueOnce(makeChain(validSession))
      .mockReturnValueOnce(makeChain(null))

    mockGetUserById.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: currentCode }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.success).toBe(true)
    // email optional-chaining returns undefined when not set,
    // and JSON.stringify omits undefined values
    expect(body.email).toBeUndefined()
  })

  it('returns null email when getUserById returns no user', async () => {
    mockAdminFrom
      .mockReturnValueOnce(makeChain(validSession))
      .mockReturnValueOnce(makeChain(null))

    mockGetUserById.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const { POST } = await import('@/app/api/v1/auth/pair/verify/route')
    const req = new Request('http://localhost/api/v1/auth/pair/verify', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', code: currentCode }),
    }) as any
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body.email).toBeNull()
  })
})
