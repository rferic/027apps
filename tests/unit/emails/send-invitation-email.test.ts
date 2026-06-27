import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendInvitationEmail } from '@/lib/use-cases/invitations/send-invitation-email'
import * as EmailModule from '@/lib/email/send'
import * as InvitationsModule from '@/lib/use-cases/invitations'

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/use-cases/invitations', () => ({
  getInvitationByToken: vi.fn(),
}))

vi.mock('@react-email/components', () => ({
  render: vi.fn(() => '<html></html>'),
}))

const mockInvitation = {
  id: '1',
  email: 'user@test.com',
  title: 'La Familia',
  locale: 'es',
  role: 'member' as const,
  token: 'abc123',
  invited_by_name: 'Eric',
  invitedBy: 'inviter-id',
  acceptedBy: null,
  acceptedAt: null,
  revokedAt: null,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  groupId: 'group-id',
  groupIds: ['group-id'],
}

describe('sendInvitationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when invitation not found', async () => {
    vi.mocked(InvitationsModule.getInvitationByToken).mockResolvedValue(null)
    const result = await sendInvitationEmail('invalid-token')
    expect(result).toEqual({ error: 'Invitation not found' })
  })

  it('calls sendEmail with correct params in spanish', async () => {
    vi.mocked(InvitationsModule.getInvitationByToken).mockResolvedValue(mockInvitation)
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    await sendInvitationEmail('abc123')

    expect(EmailModule.sendEmail).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(EmailModule.sendEmail).mock.calls[0][0]
    expect(callArgs.to).toBe('user@test.com')
    expect(callArgs.subject).toContain('Te han invitado a')
    expect(callArgs.html).toContain('Has sido invitado')
  })

  it('calls sendEmail with correct params in english', async () => {
    vi.mocked(InvitationsModule.getInvitationByToken).mockResolvedValue({ ...mockInvitation, locale: 'en' as const })

    await sendInvitationEmail('abc123')

    const callArgs = vi.mocked(EmailModule.sendEmail).mock.calls[0][0]
    expect(callArgs.subject).toContain('invited to')
    expect(callArgs.html).toContain('Accept invitation')
  })

  it('includes invite link in email html', async () => {
    vi.mocked(InvitationsModule.getInvitationByToken).mockResolvedValue(mockInvitation)

    await sendInvitationEmail('abc123')

    const callArgs = vi.mocked(EmailModule.sendEmail).mock.calls[0][0]
    expect(callArgs.html).toContain('/invite/abc123')
  })
})
