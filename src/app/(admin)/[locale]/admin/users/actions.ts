'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/auth/helpers'
import { changeUserRole, blockUser, unblockUser, updateUserProfile, deleteAdminUser } from '@/lib/use-cases/admin/users'
import { routing } from '@/i18n/routing'

async function getLocale(): Promise<string> {
  const store = await cookies()
  const raw = store.get('preferred-locale')?.value
  return raw && routing.locales.includes(raw as typeof routing.locales[number]) ? raw : 'en'
}

async function revalidateAdminUserPaths(userId?: string) {
  const locale = await getLocale()
  revalidatePath(`/${locale}/admin/users`)
  revalidatePath(`/${locale}/admin/admins`)
  revalidatePath(`/${locale}/admin/dashboard`)
  if (userId) revalidatePath(`/${locale}/admin/users/${userId}`)
}

export async function changeRoleAction(userId: string, newRole: 'admin' | 'member'): Promise<{ error: string | null }> {
  const { userId: adminId } = await requireAdmin()
  if (userId === adminId) return { error: 'You cannot change your own role' }
  const result = await changeUserRole(userId, newRole)
  if (!result.error) {
    await revalidateAdminUserPaths(userId)
  }
  return result
}

export async function blockUserAction(userId: string): Promise<{ error: string | null }> {
  const { userId: adminId } = await requireAdmin()
  if (userId === adminId) return { error: 'You cannot block yourself' }
  const result = await blockUser(userId)
  if (!result.error) {
    await revalidateAdminUserPaths(userId)
  }
  return result
}

export async function unblockUserAction(userId: string): Promise<{ error: string | null }> {
  await requireAdmin()
  const result = await unblockUser(userId)
  if (!result.error) {
    await revalidateAdminUserPaths(userId)
  }
  return result
}

export async function editUserAction(userId: string, _prevState: { error: string | null; success?: boolean }, formData: FormData): Promise<{ error: string | null; success?: boolean }> {
  await requireAdmin()
  const displayName = (formData.get('displayName') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const locale = (formData.get('locale') as string | null)?.trim() || undefined
  if (!displayName) return { error: 'Name is required' }
  if (!email) return { error: 'Email is required' }
  const result = await updateUserProfile(userId, { displayName, email, locale })
  if (!result.error) {
    await revalidateAdminUserPaths(userId)
    return { error: null, success: true }
  }
  return result
}

export async function deleteUserAction(userId: string): Promise<{ error: string | null }> {
  const { userId: adminId } = await requireAdmin()
  if (userId === adminId) return { error: 'You cannot delete yourself' }
  const result = await deleteAdminUser(userId)
  if (!result.error) {
    await revalidateAdminUserPaths()
  }
  return result
}
