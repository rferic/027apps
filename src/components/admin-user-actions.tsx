'use client'

import { useState, useTransition } from 'react'
import { Menu } from '@base-ui/react/menu'
import { useTranslations } from 'next-intl'
import type { AdminUser } from '@/lib/use-cases/admin/users'
import { changeRoleAction, blockUserAction, unblockUserAction, deleteUserAction } from '@/app/(admin)/[locale]/admin/users/actions'
import { ConfirmDialog } from './ui/confirm-dialog'

interface Props {
  user: AdminUser
  locale: string
  currentUserId: string
  onEdit: () => void
}

export function AdminUserActions({ user, currentUserId, onEdit }: Props) {
  const t = useTranslations('admin.table')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [confirmMakeMember, setConfirmMakeMember] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (user.id === currentUserId) return null

  function handleBlock() {
    setConfirmBlock(false)
    setError(null)
    startTransition(async () => {
      const result = await blockUserAction(user.id)
      if (result?.error) setError(result.error)
    })
  }

  function handleMakeMember() {
    setConfirmMakeMember(false)
    setError(null)
    startTransition(async () => {
      const result = await changeRoleAction(user.id, 'member')
      if (result?.error) setError(result.error)
    })
  }

  async function handleDelete() {
    setConfirmDelete(false)
    setError(null)
    startTransition(async () => {
      const result = await deleteUserAction(user.id)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-accent hover:text-muted-foreground transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4}>
            <Menu.Popup className="bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] z-50 outline-none">
              <Menu.Item
                closeOnClick
                onClick={onEdit}
                className="block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted cursor-pointer outline-none"
              >
                {t('edit')}
              </Menu.Item>

              {user.role === 'admin' ? (
                <Menu.Item
                  closeOnClick
                  onClick={() => setConfirmMakeMember(true)}
                  className="block w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 cursor-pointer outline-none"
                >
                  {t('makeMember')}
                </Menu.Item>
              ) : (
                <Menu.Item
                  closeOnClick
                  onClick={() => startTransition(() => { changeRoleAction(user.id, 'admin') })}
                  className="block w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted cursor-pointer outline-none"
                >
                  {t('makeAdmin')}
                </Menu.Item>
              )}

              <div className="h-px bg-slate-100 my-1" />

              {user.isBlocked ? (
                <Menu.Item
                  closeOnClick
                  onClick={() => startTransition(() => { unblockUserAction(user.id) })}
                  className="block w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 cursor-pointer outline-none"
                >
                  {t('unblock')}
                </Menu.Item>
              ) : (
                <Menu.Item
                  closeOnClick
                  onClick={() => setConfirmBlock(true)}
                  className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
                >
                  {t('block')}
                </Menu.Item>
              )}

              <div className="h-px bg-slate-100 my-1" />

              <Menu.Item
                closeOnClick
                onClick={() => setConfirmDelete(true)}
                className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
              >
                {t('delete')}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={t('confirmBlockTitle')}
        description={t('confirmBlockDesc')}
        confirmLabel={t('block')}
        cancelLabel={t('cancel')}
        onConfirm={handleBlock}
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmMakeMember}
        onOpenChange={setConfirmMakeMember}
        title={t('confirmMakeMemberTitle')}
        description={t('confirmMakeMemberDesc')}
        confirmLabel={t('makeMember')}
        cancelLabel={t('cancel')}
        onConfirm={handleMakeMember}
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('confirmDeleteTitle')}
        description={t('confirmDeleteDesc')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={handleDelete}
        loading={pending}
        variant="destructive"
      />

      {error && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm shadow-lg">
          {error}
        </div>
      )}
    </>
  )
}
