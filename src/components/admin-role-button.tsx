'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { changeRoleAction } from '@/app/(admin)/[locale]/admin/users/actions'

interface Props {
  userId: string
  currentRole: 'admin' | 'member'
  currentUserId: string
}

export function RoleChangeButton({ userId, currentRole, currentUserId }: Props) {
  const [pending, startTransition] = useTransition()
  const t = useTranslations('admin.table')

  if (userId === currentUserId) return null

  const newRole = currentRole === 'admin' ? 'member' : 'admin'

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await changeRoleAction(userId, newRole) })}
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 cursor-pointer ${
        newRole === 'admin'
          ? 'border-border bg-muted text-foreground hover:bg-accent'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      {pending ? '…' : newRole === 'admin' ? t('makeAdmin') : t('makeMember')}
    </button>
  )
}
