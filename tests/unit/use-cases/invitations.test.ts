import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createAdminClient, createAdminClientUntyped } from '@/lib/supabase/admin'
import {
  getInvitationStatus,
  getAdminInvitationList,
  createInvitation,
  revokeInvitation,
  deleteInvitation,
  acceptInvitation,
  type Invitation,
} from '@/lib/use-cases/invitations'

vi.mock('@/lib/supabase/admin')

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase-like chain that is both chainable (all builder methods
 * return `this`) and thenable (can be `await`ed directly). Terminal methods
 * `.single()` and `.maybeSingle()` resolve to `{ data, error }`.
 */
function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }

  const chain: Record<string, unknown> = {
    // Make the chain directly awaitable (used when no terminal method is called)
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
    catch: (onRejected: (v: unknown) => unknown) =>
      Promise.resolve(resolved).catch(onRejected),
    finally: (onFinally: () => void) =>
      Promise.resolve(resolved).finally(onFinally),

    // Terminal methods
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
// Pure function: getInvitationStatus
// ---------------------------------------------------------------------------

const baseInvitation: Invitation = {
  id: 'inv-1',
  token: 'abc123',
  title: 'Test Invitation',
  role: 'member',
  email: null,
  groupIds: [],
  invitedBy: 'admin-user',
  acceptedBy: null,
  acceptedAt: null,
  revokedAt: null,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  locale: 'es',
}

describe('getInvitationStatus', () => {
  it('returns pending when no dates are set', () => {
    expect(getInvitationStatus(baseInvitation)).toBe('pending')
  })

  it('returns pending when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString()
    expect(getInvitationStatus({ ...baseInvitation, expiresAt: future })).toBe('pending')
  })

  it('returns expired when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString()
    expect(getInvitationStatus({ ...baseInvitation, expiresAt: past })).toBe('expired')
  })

  it('returns accepted when acceptedAt is set', () => {
    expect(
      getInvitationStatus({ ...baseInvitation, acceptedAt: new Date().toISOString() })
    ).toBe('accepted')
  })

  it('returns revoked when revokedAt is set', () => {
    expect(
      getInvitationStatus({ ...baseInvitation, revokedAt: new Date().toISOString() })
    ).toBe('revoked')
  })

  it('revoked takes priority over accepted', () => {
    expect(
      getInvitationStatus({
        ...baseInvitation,
        revokedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
      })
    ).toBe('revoked')
  })

  it('accepted takes priority over expired', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString()
    expect(
      getInvitationStatus({
        ...baseInvitation,
        acceptedAt: new Date().toISOString(),
        expiresAt: past,
      })
    ).toBe('accepted')
  })
})

// ---------------------------------------------------------------------------
// Async functions with Supabase mock
// ---------------------------------------------------------------------------

describe('getAdminInvitationList', () => {
  const mockFrom = vi.fn()

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClient>)
    mockFrom.mockReset()
  })

  it('returns empty array when no rows', async () => {
    mockFrom.mockReturnValue(makeChain([]))
    const result = await getAdminInvitationList()
    expect(result).toEqual([])
  })

  it('maps DB rows to Invitation shape', async () => {
    const dbRow = {
      id: 'inv-1',
      token: 'tok',
      title: 'Welcome',
      role: 'member',
      email: 'user@example.com',
      invited_by: 'admin-id',
      accepted_by: null,
      accepted_at: null,
      revoked_at: null,
      expires_at: null,
      created_at: '2024-01-01T00:00:00Z',
    }
    mockFrom.mockReturnValue(makeChain([dbRow]))
    const result = await getAdminInvitationList()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'inv-1',
      token: 'tok',
      title: 'Welcome',
      role: 'member',
      email: 'user@example.com',
      invitedBy: 'admin-id',
    })
  })
})

describe('createInvitation', () => {
  const mockFrom = vi.fn()

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClient>)
    mockFrom.mockReset()
  })

  it('returns token on success', async () => {
    mockFrom.mockReturnValue(makeChain({ token: 'new-token' }))
    const result = await createInvitation({
      title: 'New member',
      role: 'member',
      email: null,
      expiresAt: null,
      invitedBy: 'admin-id',
      groupIds: [],
      locale: 'es',
    })
    expect(result).toEqual({ token: 'new-token' })
  })

  it('returns error when insert fails', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'DB error' }))
    const result = await createInvitation({
      title: 'New member',
      role: 'member',
      email: null,
      expiresAt: null,
      invitedBy: 'admin-id',
      groupIds: [],
      locale: 'es',
    })
    expect(result).toEqual({ error: 'DB error' })
  })
})

describe('revokeInvitation', () => {
  const mockFrom = vi.fn()

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClient>)
    mockFrom.mockReset()
  })

  it('returns error: null on success', async () => {
    mockFrom.mockReturnValue(makeChain(null))
    const result = await revokeInvitation('inv-1')
    expect(result).toEqual({ error: null })
  })

  it('returns error message on failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'Not found' }))
    const result = await revokeInvitation('inv-1')
    expect(result).toEqual({ error: 'Not found' })
  })
})

describe('deleteInvitation', () => {
  const mockFrom = vi.fn()

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClient>)
    mockFrom.mockReset()
  })

  it('returns error: null on success', async () => {
    mockFrom.mockReturnValue(makeChain(null))
    const result = await deleteInvitation('inv-1')
    expect(result).toEqual({ error: null })
  })

  it('returns error message on failure', async () => {
    mockFrom.mockReturnValue(makeChain(null, { message: 'Permission denied' }))
    const result = await deleteInvitation('inv-1')
    expect(result).toEqual({ error: 'Permission denied' })
  })
})

describe('acceptInvitation', () => {
  const mockFrom = vi.fn()
  const mockCreateUser = vi.fn()

  beforeEach(() => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { createUser: mockCreateUser } },
    } as unknown as ReturnType<typeof createAdminClient>)
    mockFrom.mockReset()
    mockCreateUser.mockReset()
  })

  // Helper: a valid DB invitation row (pending, open)
  const dbPendingInvitation = {
    id: 'inv-1',
    token: 'valid-token',
    title: 'Join us',
    role: 'member',
    email: null,
    invited_by: 'admin-id',
    accepted_by: null,
    accepted_at: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    created_at: new Date().toISOString(),
  }

  it('returns error when token is not found', async () => {
    mockFrom.mockReturnValueOnce(makeChain(null)) // getInvitationByToken → not found
    const result = await acceptInvitation('bad-token', {
      email: 'user@example.com',
      displayName: 'User',
      password: 'pass123',
    })
    expect(result).toEqual({ errorCode: 'invalid_invitation' })
  })

  it('returns error when invitation is revoked', async () => {
    const revokedRow = { ...dbPendingInvitation, revoked_at: new Date().toISOString() }
    mockFrom.mockReturnValueOnce(makeChain(revokedRow))
    const result = await acceptInvitation('valid-token', {
      email: 'user@example.com',
      displayName: 'User',
      password: 'pass123',
    })
    expect(result).toEqual({ errorCode: 'invitation_status', status: 'revoked' })
  })

  it('returns error when invitation is expired', async () => {
    const expiredRow = {
      ...dbPendingInvitation,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    }
    mockFrom.mockReturnValueOnce(makeChain(expiredRow))
    const result = await acceptInvitation('valid-token', {
      email: 'user@example.com',
      displayName: 'User',
      password: 'pass123',
    })
    expect(result).toEqual({ errorCode: 'invitation_status', status: 'expired' })
  })

  it('returns error when email does not match a restricted invitation', async () => {
    const emailRestrictedRow = { ...dbPendingInvitation, email: 'specific@example.com' }
    mockFrom.mockReturnValueOnce(makeChain(emailRestrictedRow))
    const result = await acceptInvitation('valid-token', {
      email: 'other@example.com',
      displayName: 'User',
      password: 'pass123',
    })
    expect(result).toEqual({ errorCode: 'email_mismatch' })
  })

  it('allows accepting when email matches (case-insensitive)', async () => {
    const emailRestrictedRow = { ...dbPendingInvitation, email: 'User@Example.com' }
    mockFrom.mockReturnValueOnce(makeChain(emailRestrictedRow)) // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(null))               // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain({ id: 'group-id' })) // groups
    mockFrom.mockReturnValueOnce(makeChain(null))               // group_members.insert
    mockFrom.mockReturnValueOnce(makeChain(null))               // invitations.update

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'user@example.com', // lowercase variant
      displayName: 'User',
      password: 'pass123',
    })
    expect(result).toEqual({ success: true })
  })

  it('returns error when user creation fails', async () => {
    mockFrom.mockReturnValueOnce(makeChain(dbPendingInvitation))
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already in use' },
    })
    const result = await acceptInvitation('valid-token', {
      email: 'user@example.com',
      displayName: 'User',
      password: 'pass123',
    })
    expect(result).toEqual({ errorCode: 'failed_to_create_user' })
  })

  it('returns success on happy path (open invitation)', async () => {
    mockFrom.mockReturnValueOnce(makeChain(dbPendingInvitation)) // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(null))                // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain({ id: 'group-id' })) // groups
    mockFrom.mockReturnValueOnce(makeChain(null))                // group_members.insert
    mockFrom.mockReturnValueOnce(makeChain(null))                // invitations.update

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'newuser@example.com',
      displayName: 'New User',
      password: 'securepass',
    })
    expect(result).toEqual({ success: true })
  })

  it('still returns success when no group is found (skips group_members insert)', async () => {
    mockFrom.mockReturnValueOnce(makeChain(dbPendingInvitation)) // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(null))                // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain(null))                // groups → no group
    mockFrom.mockReturnValueOnce(makeChain(null))                // invitations.update

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'newuser@example.com',
      displayName: 'New User',
      password: 'securepass',
    })
    expect(result).toEqual({ success: true })
  })
})
