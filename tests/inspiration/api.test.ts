import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/use-cases/inspiration/send-notifications', () => ({
  notifyNewComment: vi.fn(() => Promise.resolve()),
  notifyStatusChange: vi.fn(() => Promise.resolve()),
  notifyNewIdea: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/apps/manifest', () => ({
  readManifest: vi.fn(),
}))

vi.mock('@/lib/push', () => ({
  sendPushNotifications: vi.fn().mockResolvedValue(undefined),
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
  NOTIFICATION_TYPES: {
    INSPIRATION_VOTE: 'inspiration:vote',
  },
}))

// Shared mock client — reset in beforeEach
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClientUntyped: vi.fn(() => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal Supabase-like chainable mock for makeChain. */
function makeChain(data: unknown, error: unknown = null, count?: number) {
  const resolved: Record<string, unknown> = { data, error }
  if (count !== undefined) resolved.count = count
  const chain: Record<string, unknown> = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).catch(fn),
    finally: (fn: () => void) => Promise.resolve(resolved).finally(fn),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'limit', 'order', 'rpc', 'filter', 'or', 'range', 'not', 'is', 'neq']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function makeRequest(path: string, method = 'GET', body?: unknown, headers?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: { ...headers },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = init.headers || {}
    ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
  }
  return new Request(`http://localhost${path}`, init)
}

const sampleRequest = {
  id: 'r1',
  user_id: 'u1',
  title: 'Add dark mode',
  description: 'Please add a dark mode toggle',
  type: 'improvement',
  status: 'pending',
  app_slug: null,
  group_id: 'g1',
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-01-15T10:30:00Z',
}

const sampleComment = {
  id: 'c1',
  request_id: 'r1',
  user_id: 'u2',
  body: 'Great idea!',
  created_at: '2025-01-15T11:00:00Z',
  updated_at: '2025-01-15T11:00:00Z',
}

const Ctx = { groupId: 'g1', groupSlug: 'test', userId: 'u1', role: 'member' as const, locale: 'en' }

// ---------------------------------------------------------------------------
// GET listRequests
// ---------------------------------------------------------------------------

describe('GET /api/v1/:groupSlug/apps/inspiration', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 200 with paginated data for date-based sort (newest)', async () => {
    // count query
    mockFrom.mockReturnValueOnce(makeChain(null, null, 5))
    // data query (with order + range)
    const twoRows = [
      sampleRequest,
      { ...sampleRequest, id: 'r2', title: 'Second idea', created_at: '2025-01-16T10:30:00Z' },
    ]
    mockFrom.mockReturnValueOnce(makeChain(twoRows))
    // enrich: votes, comments, userVotes, profiles
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))

    const { default: handler } = await import('../../apps/inspiration/routes/GET')
    const req = makeRequest('/api/v1/test/apps/inspiration?limit=2&page=1')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pagination).toEqual({ page: 1, limit: 2, total: 5, total_pages: 3 })
  })

  it('returns 200 with empty array when count=0', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, null, 0))
    // verify query returns no rows
    mockFrom.mockReturnValueOnce(makeChain([]))

    const { default: handler } = await import('../../apps/inspiration/routes/GET')
    const req = makeRequest('/api/v1/test/apps/inspiration')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
    expect(body.pagination.total_pages).toBe(0)
  })

  it('returns data without userId in context', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, null, 1))
    mockFrom.mockReturnValueOnce(makeChain([sampleRequest]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))

    const { default: handler } = await import('../../apps/inspiration/routes/GET')
    const req = makeRequest('/api/v1/test/apps/inspiration')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
  })

  it('filters by status and type', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null, null, 1))
    mockFrom.mockReturnValueOnce(makeChain([sampleRequest]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))
    mockFrom.mockReturnValueOnce(makeChain([]))

    const { default: handler } = await import('../../apps/inspiration/routes/GET')
    const req = makeRequest('/api/v1/test/apps/inspiration?status=pending,reviewing&type=bug')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// POST createRequest
// ---------------------------------------------------------------------------

describe('POST /api/v1/:groupSlug/apps/inspiration', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 201 with the created request', async () => {
    const created = { ...sampleRequest, id: 'new-id' }
    // insert → first .from()
    mockFrom.mockReturnValueOnce(makeChain(created))
    // isGitHubSyncEnabled → app_settings query → returns sync disabled
    mockFrom.mockReturnValueOnce(makeChain({ value: false }))
    // notifyNewIdea → profiles query
    mockFrom.mockReturnValueOnce(makeChain([{ display_name: 'Test User' }]))

    const { default: handler } = await import('../../apps/inspiration/routes/POST')
    const req = makeRequest('/api/v1/test/apps/inspiration', 'POST', {
      title: 'Add dark mode',
      description: 'Please add a dark mode toggle',
      type: 'improvement',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe('Add dark mode')
  })

  it('returns 422 when title is missing', async () => {
    const { default: handler } = await import('../../apps/inspiration/routes/POST')
    const req = makeRequest('/api/v1/test/apps/inspiration', 'POST', {
      type: 'bug',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(422)
  })

  it('returns 422 when type is invalid', async () => {
    const { default: handler } = await import('../../apps/inspiration/routes/POST')
    const req = makeRequest('/api/v1/test/apps/inspiration', 'POST', {
      title: 'Test',
      type: 'invalid_type',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(422)
  })

  it('returns 400 for non-JSON body', async () => {
    const { default: handler } = await import('../../apps/inspiration/routes/POST')
    const req = new Request('http://localhost/api/v1/test/apps/inspiration', {
      method: 'POST',
      body: 'not json',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// PUT updateRequest
// ---------------------------------------------------------------------------

describe('PUT /api/v1/:groupSlug/apps/inspiration/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('allows creator to update title', async () => {
    // Fetch existing
    mockFrom.mockReturnValueOnce(makeChain({ ...sampleRequest, user_id: 'u1' }))
    // Update
    mockFrom.mockReturnValueOnce(makeChain({ ...sampleRequest, title: 'Updated title' }))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/PUT')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1', 'PUT', { title: 'Updated title' })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
  })

  it('returns 403 when non-creator non-admin tries to update', async () => {
    const testCtx = { ...Ctx, userId: 'u2' }

    // Fetch existing — owned by u1
    mockFrom.mockReturnValueOnce(makeChain({ ...sampleRequest, user_id: 'u1' }))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/PUT')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1', 'PUT', { title: 'Hacked' })
    const res = await handler(req, testCtx)

    expect(res.status).toBe(403)
  })

  it('allows admin to update status', async () => {
    const adminCtx = { ...Ctx, userId: 'admin1', role: 'admin' as const }

    mockFrom.mockReturnValueOnce(makeChain({ ...sampleRequest, user_id: 'u1', status: 'pending' }))
    mockFrom.mockReturnValueOnce(makeChain({ ...sampleRequest, status: 'in_progress' }))
    // syncStatusToGitHubIssue → reads idea to check github_issue_number
    mockFrom.mockReturnValueOnce(makeChain({ github_issue_number: null, github_issue_url: null, type: 'bug' }))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/PUT')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1', 'PUT', { status: 'in_progress' })
    const res = await handler(req, adminCtx)

    expect(res.status).toBe(200)
  })

  it('returns 404 when request does not exist', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/PUT')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1', 'PUT', { title: 'Nope' })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// DELETE deleteRequest
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/:groupSlug/apps/inspiration/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 204 with no content for creator', async () => {
    mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
    mockFrom.mockReturnValueOnce(makeChain(null, null))

    const { default: handler } = await import('../../apps/inspiration/routes/GET')
    const { default: deleteHandler } = await import('../../apps/inspiration/routes/[id]/DELETE')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1', 'DELETE')
    const res = await deleteHandler(req, Ctx)

    expect(res.status).toBe(204)
    const text = await res.text()
    expect(text).toBe('')
  })

  it('returns 403 for non-creator non-admin', async () => {
    const testCtx = { ...Ctx, userId: 'u2' }

    mockFrom.mockReturnValueOnce(makeChain({ user_id: 'u1' }))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/DELETE')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1', 'DELETE')
    const res = await handler(req, testCtx)

    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST toggleVote
// ---------------------------------------------------------------------------

describe('POST /api/v1/:groupSlug/apps/inspiration/:id/vote', () => {
  beforeEach(() => vi.resetAllMocks())

  it('toggles vote on (no existing vote) and returns voted:true with count', async () => {
    // Request exists
    mockFrom.mockReturnValueOnce(makeChain({ id: 'r1' }))
    // No existing vote
    mockFrom.mockReturnValueOnce(makeChain(null))
    // Insert succeeds
    mockFrom.mockReturnValueOnce(makeChain(null))
    // Profiles query (voter display_name)
    mockFrom.mockReturnValueOnce(makeChain(null))
    // Group members query (admins)
    mockFrom.mockReturnValueOnce(makeChain([]))
    // Count votes
    mockFrom.mockReturnValueOnce(makeChain(null, null, 3))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/vote')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/vote', 'POST')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.voted).toBe(true)
    expect(body.vote_count).toBe(3)
  })

  it('toggles vote off (existing vote) and returns voted:false with count', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ id: 'r1' }))
    // Existing vote
    mockFrom.mockReturnValueOnce(makeChain({ id: 'v1' }))
    // Delete succeeds
    mockFrom.mockReturnValueOnce(makeChain(null))
    // Count votes
    mockFrom.mockReturnValueOnce(makeChain(null, null, 2))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/vote')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/vote', 'POST')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.voted).toBe(false)
    expect(body.vote_count).toBe(2)
  })

  it('returns 404 when request does not exist', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/vote')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/vote', 'POST')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST createComment
// ---------------------------------------------------------------------------

describe('POST /api/v1/:groupSlug/apps/inspiration/:id/comments', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 201 with the created comment', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ id: 'r1' }))
    const created = { ...sampleComment, id: 'new-comment-id' }
    mockFrom.mockReturnValueOnce(makeChain(created))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/comments/POST')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/comments', 'POST', {
      body: 'Great idea!',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('new-comment-id')
    expect(body.body).toBe('Great idea!')
  })

  it('returns 422 when body is empty', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ id: 'r1' }))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/comments/POST')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/comments', 'POST', {
      body: '',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(422)
  })

  it('returns 404 when request does not exist', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/comments/POST')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/comments', 'POST', {
      body: 'Hello',
    })
    const res = await handler(req, Ctx)

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET listComments
// ---------------------------------------------------------------------------

describe('GET /api/v1/:groupSlug/apps/inspiration/:id/comments', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 200 with paginated comments', async () => {
    // verify request exists
    mockFrom.mockReturnValueOnce(makeChain({ id: 'r1' }))
    // count comments
    mockFrom.mockReturnValueOnce(makeChain(null, null, 2))
    // fetch comments
    mockFrom.mockReturnValueOnce(makeChain([sampleComment, { ...sampleComment, id: 'c2', body: 'Agreed!' }]))
    // enrich profiles
    mockFrom.mockReturnValueOnce(makeChain([
      { id: 'u2', display_name: 'Jane', avatar_url: null },
    ]))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/comments/GET')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/comments?limit=10')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.pagination.total).toBe(2)
    // Check user enrichment
    expect(body.data[0].user?.display_name).toBe('Jane')
  })

  it('returns empty list with pagination when no comments', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ id: 'r1' }))
    mockFrom.mockReturnValueOnce(makeChain(null, null, 0))

    const { default: handler } = await import('../../apps/inspiration/routes/[id]/comments/GET')
    const req = makeRequest('/api/v1/test/apps/inspiration/r1/comments')
    const res = await handler(req, Ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
  })
})
