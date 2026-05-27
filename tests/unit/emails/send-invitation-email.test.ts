import { vi, describe, it, expect, beforeEach } from 'vitest'
import { sendInvitationEmail } from '@/lib/use-cases/invitations/send-invitation-email'
import { getInvitationByToken } from '@/lib/use-cases/invitations'
import { sendEmail } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/use-cases/invitations', async () => {
  const actual = await vi.importActual('@/lib/use-cases/invitations')
  return { ...actual, getInvitationByToken: vi.fn() }
})
vi.mock('@/lib/email/send')
vi.mock('@/lib/supabase/admin')

const mockInvitation = {
  id: 'inv-1',
  token: 'abc123',
  title: 'Test Group',
  role: 'member' as const,
  email: 'user@test.com',
  groupIds: ['g1'],
  invitedBy: 'admin-user',
  acceptedBy: null,
  acceptedAt: null,
  revokedAt: null,
  expiresAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  locale: 'es',
}

function makeAdminClientMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { display_name: 'Admin User' }, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createAdminClient).mockReturnValue(makeAdminClientMock() as any)
})

describe('sendInvitationEmail', () => {
  it('returns error when invitation not found', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(null)
    const result = await sendInvitationEmail('invalid-token')
    expect(result).toEqual({ error: 'Invitation not found' })
  })

  it('calls sendEmail with correct params in spanish', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(mockInvitation)
    vi.mocked(sendEmail).mockResolvedValue({ error: null })
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    const result = await sendInvitationEmail('abc123')

    expect(result).toEqual({ error: null })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(sendEmail).mock.calls[0][0]
    expect(callArgs.to).toBe('user@test.com')
    expect(callArgs.subject).toContain('Te han invitado a')
    expect(callArgs.html).toContain('Has sido invitado')
  })

  it('calls sendEmail with correct params in english', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue({ ...mockInvitation, locale: 'en' })
    vi.mocked(sendEmail).mockResolvedValue({ error: null })

    const result = await sendInvitationEmail('abc123')

    expect(result).toEqual({ error: null })
    const callArgs = vi.mocked(sendEmail).mock.calls[0][0]
    expect(callArgs.subject).toContain('invited to')
    expect(callArgs.html).toContain('Accept invitation')
  })

  it('returns error when sendEmail fails', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(mockInvitation)
    vi.mocked(sendEmail).mockResolvedValue({ error: 'Resend API error' })

    const result = await sendInvitationEmail('abc123')

    expect(result).toEqual({ error: 'Resend API error' })
  })

  it('includes invite link in email html', async () => {
    vi.mocked(getInvitationByToken).mockResolvedValue(mockInvitation)
    vi.mocked(sendEmail).mockResolvedValue({ error: null })

    await sendInvitationEmail('abc123')

    const callArgs = vi.mocked(sendEmail).mock.calls[0][0]
    expect(callArgs.html).toContain('/invite/abc123')
  })
})
