import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createApiClient, createApiAdminClient } from '@/lib/supabase/api'

vi.mock('@/lib/supabase/api', () => ({
  createApiClient: vi.fn(),
  createApiAdminClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeReq = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/v1/test', { headers })

/**
 * Creates a minimal Supabase-like chainable mock.
 */
function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }

  const chain: Record<string, unknown> = {
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
    catch: (onRejected: (v: unknown) => unknown) =>
      Promise.resolve(resolved).catch(onRejected),
    finally: (onFinally: () => void) =>
      Promise.resolve(resolved).finally(onFinally),

    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }

  for (const m of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'is', 'limit', 'order', 'filter',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }

  return chain
}

// ---------------------------------------------------------------------------
// authenticate — 'public' level
// ---------------------------------------------------------------------------

describe("authenticate — 'public'", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns UseCaseContext without userId when no auth header is present', async () => {
    const mockAdminFrom = vi.fn()
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )
    mockAdminFrom.mockReturnValue(makeChain({ id: 'group-abc' }))

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq()
    const result = await authenticate(req, 'public')

    expect(result).not.toBeInstanceOf(Response)
    const ctx = result as { groupId: string; userId?: string }
    expect(ctx.groupId).toBe('group-abc')
    expect(ctx.userId).toBeUndefined()
  })

  it('returns 404 Response when no group is configured', async () => {
    const mockAdminFrom = vi.fn()
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )
    mockAdminFrom.mockReturnValue(makeChain(null))

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq()
    const result = await authenticate(req, 'public')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// authenticate — 'jwt' level
// ---------------------------------------------------------------------------

describe("authenticate — 'jwt'", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 401 Response when there is no Authorization header', async () => {
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createApiAdminClient>
    )

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq()
    const result = await authenticate(req, 'jwt')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns 401 Response when the token is invalid (getUser returns error)', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    })
    vi.mocked(createApiClient).mockReturnValue(
      { auth: { getUser: mockGetUser } } as unknown as ReturnType<typeof createApiClient>
    )
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createApiAdminClient>
    )

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ Authorization: 'Bearer invalid-token' })
    const result = await authenticate(req, 'jwt')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns 403 Response when the user is not a member of any group', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    const mockAdminFrom = vi.fn()

    vi.mocked(createApiClient).mockReturnValue(
      { auth: { getUser: mockGetUser } } as unknown as ReturnType<typeof createApiClient>
    )
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )

    // group_members returns null (not found)
    mockAdminFrom.mockReturnValue(makeChain(null))

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ Authorization: 'Bearer valid-but-no-membership' })
    const result = await authenticate(req, 'jwt')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('returns UseCaseContext with userId when the token is valid and user is a member', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    const mockAdminFrom = vi.fn()
    const memberRows = [{ group_id: 'group-abc', role: 'member' }]

    vi.mocked(createApiClient).mockReturnValue(
      { auth: { getUser: mockGetUser } } as unknown as ReturnType<typeof createApiClient>
    )
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )

    mockAdminFrom.mockReturnValue(makeChain(memberRows))

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ Authorization: 'Bearer valid-token' })
    const result = await authenticate(req, 'jwt')

    expect(result).not.toBeInstanceOf(Response)
    const ctx = result as { userId: string; groupId: string; role: string }
    expect(ctx.userId).toBe('user-123')
    expect(ctx.groupId).toBe('group-abc')
    expect(ctx.role).toBe('member')
  })
})

// ---------------------------------------------------------------------------
// authenticate — 'apikey' level
// ---------------------------------------------------------------------------

describe("authenticate — 'apikey'", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 401 Response when there is no X-API-Key header', async () => {
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createApiAdminClient>
    )

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq()
    const result = await authenticate(req, 'apikey')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns 401 Response when the API key does not exist in the DB', async () => {
    const mockAdminFrom = vi.fn()
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )

    // Key lookup returns null
    mockAdminFrom.mockReturnValue(makeChain(null))

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ 'X-API-Key': 'sk_027_unknownkey123456789012345678901' })
    const result = await authenticate(req, 'apikey')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns 401 Response when the API key has been revoked', async () => {
    const mockAdminFrom = vi.fn()
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )

    // Key exists but has revoked_at set
    const revokedKey = {
      group_id: 'group-abc',
      user_id: null,
      revoked_at: '2024-01-01T00:00:00Z',
    }
    mockAdminFrom.mockReturnValue(makeChain(revokedKey))

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ 'X-API-Key': 'sk_027_revokedkey1234567890123456789012' })
    const result = await authenticate(req, 'apikey')

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns UseCaseContext without userId for group-scoped valid API key', async () => {
    const mockAdminFrom = vi.fn()
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )

    const validKey = {
      group_id: 'group-abc',
      user_id: null,
      revoked_at: null,
    }

    // First call: lookup by hash → found
    // Second call (best-effort update): update last_used_at
    const lookupChain = makeChain(validKey)
    const updateChain = makeChain(null)
    mockAdminFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValue(updateChain)

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ 'X-API-Key': 'sk_027_validkey12345678901234567890123' })
    const result = await authenticate(req, 'apikey')

    expect(result).not.toBeInstanceOf(Response)
    const ctx = result as { groupId: string; userId?: string }
    expect(ctx.groupId).toBe('group-abc')
    expect(ctx.userId).toBeUndefined()
  })

  it('returns UseCaseContext with userId for user-scoped valid API key', async () => {
    const mockAdminFrom = vi.fn()
    vi.mocked(createApiAdminClient).mockReturnValue(
      { from: mockAdminFrom } as unknown as ReturnType<typeof createApiAdminClient>
    )

    const validUserKey = {
      group_id: 'group-abc',
      user_id: 'user-42',
      revoked_at: null,
    }

    const lookupChain = makeChain(validUserKey)
    const updateChain = makeChain(null)
    mockAdminFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValue(updateChain)

    const { authenticate } = await import('@/lib/api/auth')

    const req = makeReq({ 'X-API-Key': 'sk_027_userkey1234567890123456789012345' })
    const result = await authenticate(req, 'apikey')

    expect(result).not.toBeInstanceOf(Response)
    const ctx = result as { groupId: string; userId?: string }
    expect(ctx.groupId).toBe('group-abc')
    expect(ctx.userId).toBe('user-42')
  })
})
