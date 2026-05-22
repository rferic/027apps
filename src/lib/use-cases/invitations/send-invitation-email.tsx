import { render } from '@react-email/components'
import { InvitationEmail } from '@/emails/invitation'
import { sendEmail } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInvitationByToken } from './index'

export async function sendInvitationEmail(
  token: string,
): Promise<{ error: string | null }> {
  const invitation = await getInvitationByToken(token)
  if (!invitation) return { error: 'Invitation not found' }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', invitation.invitedBy)
    .single()

  const inviterName = profile?.display_name ?? 'Someone'

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/invite/${token}`

  const html = await render(
    <InvitationEmail
      groupName={invitation.title}
      inviterName={inviterName}
      inviteLink={inviteUrl}
      locale={invitation.locale}
    />,
  )

  const labels: Record<string, string> = {
    en: `You've been invited to ${invitation.title}`,
    es: `Te han invitado a ${invitation.title}`,
    it: `Sei stato invitato a ${invitation.title}`,
    ca: `T'han convidat a ${invitation.title}`,
    fr: `Vous avez été invité à ${invitation.title}`,
    de: `Du wurdest eingeladen, ${invitation.title}`,
  }
  const subject = labels[invitation.locale] ?? labels.en

  return sendEmail({
    to: invitation.email ?? '',
    subject,
    html,
  })
}
