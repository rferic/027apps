'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/auth/helpers'
import { checkRateLimit } from '@/lib/rate-limit'
import { createInvitation as _create, revokeInvitation as _revoke, deleteInvitation as _delete } from '@/lib/use-cases/invitations'
import { sendInvitationEmail } from '@/lib/use-cases/invitations/send-invitation-email'

const VALID_LOCALES = ['en', 'es', 'it', 'ca', 'fr', 'de']

async function getLocale(): Promise<string> {
  const store = await cookies()
  const raw = store.get('preferred-locale')?.value
  return raw && VALID_LOCALES.includes(raw) ? raw : 'en'
}

export async function createInvitationAction(formData: FormData): Promise<{ error: string } | { token: string }> {
  const { userId } = await requireAdmin()
  const title = (formData.get('title') as string).trim()
  const role = (formData.get('role') as 'admin' | 'member') || 'member'
  const email = (formData.get('email') as string | null)?.trim() || null
  const expiresAt = (formData.get('expires_at') as string | null) || null
  const groupIdsStr = (formData.get('group_ids') as string) || '[]'
  const locale = (formData.get('locale') as string) || 'es'
  let groupIds: string[] = []
  try { groupIds = JSON.parse(groupIdsStr) } catch { /* ignore */ }
  if (!title) return { error: 'Title is required' }
  if (groupIds.length === 0) return { error: 'At least one group is required' }
  const result = await _create({ title, role, email, expiresAt, invitedBy: userId, groupIds, locale })
  if ('error' in result) return result
  const adminLocale = await getLocale()
  revalidatePath(`/${adminLocale}/admin/invitations`)
  return { token: result.token }
}

export async function sendInvitationEmailAction(token: string, email: string): Promise<{ error: string | null }> {
  await requireAdmin()
  if (!email) return { error: 'Email is required' }

  const rateCheck = checkRateLimit(`send-invite:${token}`, 2, 60_000)
  if (!rateCheck.allowed) return { error: 'Too many requests. Try again later.' }

  return sendInvitationEmail(token)
}

export async function revokeInvitationAction(id: string): Promise<void> {
  await requireAdmin()
  await _revoke(id)
  const locale = await getLocale()
  revalidatePath(`/${locale}/admin/invitations`)
}

export async function deleteInvitationAction(id: string): Promise<void> {
  await requireAdmin()
  await _delete(id)
  const locale = await getLocale()
  revalidatePath(`/${locale}/admin/invitations`)
}
