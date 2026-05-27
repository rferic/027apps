import { getTranslations } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'
import { getInvitationByToken, getInvitationStatus } from '@/lib/use-cases/invitations'
import { InviteForm } from './InviteForm'

type Props = { params: Promise<{ token: string }> }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return <ErrorPage message="Invalid invitation link." />
  }

  const status = getInvitationStatus(invitation)
  setRequestLocale(invitation.locale)
  const t = await getTranslations({ locale: invitation.locale, namespace: 'invite' })

  if (status !== 'pending') {
    const statusMessages: Record<string, string> = {
      accepted: t('already_used'),
      expired: t('expired'),
      revoked: t('revoked'),
    }
    return <ErrorPage message={statusMessages[status] || t('invalid')} />
  }

  const labels = {
    full_name: t('full_name'),
    email: t('email'),
    password: t('password'),
    your_name: t('your_name'),
    email_placeholder: t('email_placeholder'),
    min_chars: t('min_chars'),
    creating: t('creating'),
    create_account: t('create_account'),
    joining_as: t('joining_as'),
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo-icon.svg" alt="Logo" width={36} height={36} className="mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{invitation.title}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <InviteForm
            token={token}
            lockedEmail={invitation.email}
            role={invitation.role}
            locale={invitation.locale}
            labels={labels}
          />
        </div>
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  )
}
