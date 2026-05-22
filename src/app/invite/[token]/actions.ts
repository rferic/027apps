'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { acceptInvitation } from '@/lib/use-cases/invitations'
import { createClient } from '@/lib/supabase/server'
import { routing } from '@/i18n/routing'

export async function acceptInvitationAction(
  token: string,
  formData: FormData,
  invitationLocale?: string
): Promise<{ error: string } | void> {
  const email = (formData.get('email') as string).trim()
  const displayName = (formData.get('display_name') as string).trim()
  const password = formData.get('password') as string

  if (!email || !displayName || !password) return { error: 'All fields are required' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters' }

  const result = await acceptInvitation(token, { email, displayName, password })
  if ('error' in result) return result

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  const cookieStore = await cookies()
  const raw = cookieStore.get('preferred-locale')?.value
  const locale = invitationLocale && routing.locales.includes(invitationLocale as typeof routing.locales[number])
    ? invitationLocale
    : (raw && routing.locales.includes(raw as typeof routing.locales[number]) ? raw : 'en')
  redirect(`/${locale}/`)
}
