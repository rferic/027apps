import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'
import { getInvitationByToken, getInvitationStatus } from '@/lib/use-cases/invitations'
import { InviteForm } from './InviteForm'

type PageData =
  | { ok: true; token: string; invitation: NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>; status: ReturnType<typeof getInvitationStatus>; t: Awaited<ReturnType<typeof getTranslations>> }
  | { ok: false; error: 'not_found' | 'system' }

async function getPageData(token: string): Promise<PageData> {
  try {
    const invitation = await getInvitationByToken(token)
    if (!invitation) return { ok: false, error: 'not_found' }

    const status = getInvitationStatus(invitation)
    setRequestLocale(invitation.locale)
    const t = await getTranslations({ locale: invitation.locale, namespace: 'invite' })

    return { ok: true, token, invitation, status, t }
  } catch (err) {
    console.error('[InvitePage] Error loading invitation:', err)
    return { ok: false, error: 'system' }
  }
}

type Props = { params: Promise<{ token: string }> }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const data = await getPageData(token)
  if (!data.ok) return <ErrorPage variant={data.error} />

  const { invitation, status, t } = data

  if (status !== 'pending') {
    const statusMessages: Record<string, string> = {
      accepted: t('already_used'),
      expired: t('expired'),
      revoked: t('revoked'),
    }
    return <ErrorPage variant="status" message={statusMessages[status] || t('invalid')} />
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
          <Image src="/logo-icon.svg" alt="Logo" width={36} height={36} className="mx-auto mb-4" />
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

function ErrorPage({ variant, message }: { variant: 'not_found' | 'status' | 'system'; message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Image src="/logo-icon.svg" alt="Logo" width={48} height={48} className="mx-auto mb-6" />
        {variant === 'not_found' && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Invalid invitation link</h1>
            <p className="text-sm text-slate-500 mb-6">This invitation link doesn&apos;t exist or may have been removed.</p>
          </>
        )}
        {variant === 'status' && (
          <p className="text-sm text-slate-500 mb-6">{message}</p>
        )}
        {variant === 'system' && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-6">An unexpected error occurred. Please try again later.</p>
          </>
        )}
        <Link
          href="/"
          className="inline-block px-5 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Go to home
        </Link>
      </div>
    </div>
  )
}
