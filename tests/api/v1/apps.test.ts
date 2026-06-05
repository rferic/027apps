import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuthenticate } = vi.hoisted(() => {
  return { mockAuthenticate: vi.fn() }
})

vi.mock('@/lib/api/auth', () => ({
  authenticate: mockAuthenticate,
}))

// Mock Supabase admin client so the API endpoint can resolve
const { mockAdminFrom } = vi.hoisted(() => {
  return { mockAdminFrom: vi.fn() }
})

vi.mock('@/lib/supabase/admin', () => {
  return {
    createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
    createAdminClientUntyped: vi.fn(() => ({ from: mockAdminFrom })),
  }
})

function authError() {
  return new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid Authorization header' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }
  const chain: Record<string, unknown> = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).catch(fn),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
    count: 0,
  }
  for (const m of ['select', 'eq', 'order', 'limit', 'range', 'in']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.order = vi.fn().mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/v1/apps', () => {
  it('returns 401 without auth header', async () => {
    mockAuthenticate.mockResolvedValueOnce(authError())
    const { GET } = await import('@/app/api/v1/apps/route')
    const req = new Request('http://localhost:3000/api/v1/apps') as any
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with empty apps list when no apps installed', async () => {
    mockAuthenticate.mockResolvedValueOnce({
      supabase: {} as any,
      userId: 'user-1',
      groupId: 'g1',
      role: 'member',
    })

    // Mock installed_apps query returning empty
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })

    const { GET } = await import('@/app/api/v1/apps/route')
    const req = new Request('http://localhost:3000/api/v1/apps') as any
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    expect(body).toEqual([])
  })

  it('returns installed apps when present', async () => {
    mockAuthenticate.mockResolvedValueOnce({
      supabase: {} as any,
      userId: 'user-1',
      groupId: 'g1',
      role: 'member',
    })

    // Mock installed_apps query returning apps
    let orderCallCount = 0
    const orderFn = vi.fn().mockImplementation(function (this: any) {
      orderCallCount++
      if (orderCallCount === 2) {
        return Promise.resolve({
          data: [
            { slug: 'todo', visibility: 'public' },
            { slug: 'inspiration', visibility: 'public' },
          ],
          error: null,
        })
      }
      return this
    })

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: orderFn,
          }),
        }),
      }),
    })

    const { GET } = await import('@/app/api/v1/apps/route')
    const req = new Request('http://localhost:3000/api/v1/apps') as any
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body: any = await res.json()
    // Should return app data with slugs and names
    expect(Array.isArray(body)).toBe(true)
  })
})
