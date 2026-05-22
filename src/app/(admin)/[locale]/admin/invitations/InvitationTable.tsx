'use client'

import { useState, useTransition } from 'react'
import { Menu } from '@base-ui/react/menu'
import { useTranslations } from 'next-intl'
import type { Invitation, InvitationStatus } from '@/lib/use-cases/invitations'
import { getInvitationStatus } from '@/lib/use-cases/invitations'
import { revokeInvitationAction, deleteInvitationAction, sendInvitationEmailAction } from './actions'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
  invitations: Invitation[]
  baseUrl: string
}

const STATUS_STYLES: Record<InvitationStatus, string> = {
  pending: 'bg-slate-100 text-slate-500',
  accepted: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-amber-50 text-amber-700',
  revoked: 'bg-red-50 text-red-600',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function shortToken(token: string): string {
  return token.slice(0, 8)
}

function InviteRow({ inv, baseUrl }: { inv: Invitation; baseUrl: string }) {
  const [pending, startTransition] = useTransition()
  const t = useTranslations('admin.invitations')
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const status = getInvitationStatus(inv)
  const inviteUrl = `${baseUrl}/invite/${inv.token}`
  const canRevoke = status === 'pending'
  const canDelete = status !== 'accepted'

  function handleRevoke() {
    setConfirmRevoke(false)
    startTransition(() => { revokeInvitationAction(inv.id) })
  }

  function handleDelete() {
    setConfirmDelete(false)
    startTransition(() => { deleteInvitationAction(inv.id) })
  }

  const hasActions = status === 'pending' || canDelete

  return (
    <tr className="bg-white hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 text-sm">{inv.title}</p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{shortToken(inv.token)}…</p>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          inv.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          {inv.role}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
        {inv.email ?? <span className="text-gray-300 italic">{t('table.any')}</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
        {inv.groupIds.length}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status]}`}>
          {t(`status.${status}`)}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
        {formatDate(inv.expiresAt)}
      </td>
      <td className="px-4 py-3">
        {hasActions && (
          <>
            <Menu.Root>
              <Menu.Trigger
                disabled={pending}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="end" sideOffset={4}>
                  <Menu.Popup className="bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px] z-50 outline-none">
                    {status === 'pending' && (
                      <Menu.Item
                        closeOnClick
                        onClick={() => navigator.clipboard.writeText(inviteUrl)}
                        className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none"
                      >
                        {t('table.copyLink')}
                      </Menu.Item>
                    )}
                    {status === 'pending' && inv.email && (
                      <Menu.Item
                        closeOnClick
                        onClick={() => {
                          startTransition(async () => {
                            const result = await sendInvitationEmailAction(inv.token, inv.email!)
                            if (result.error) {
                              toast.error(result.error)
                            } else {
                              toast.success(t('email_resent', { email: inv.email! }))
                            }
                          })
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer outline-none"
                      >
                        {t('resent_button')}
                      </Menu.Item>
                    )}
                    {canRevoke && (
                      <Menu.Item
                        closeOnClick
                        onClick={() => setConfirmRevoke(true)}
                        className="block w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 cursor-pointer outline-none"
                      >
                        {t('table.revoke')}
                      </Menu.Item>
                    )}
                    {canDelete && (
                      <>
                        {canRevoke && <div className="h-px bg-slate-100 my-1" />}
                        <Menu.Item
                          closeOnClick
                          onClick={() => setConfirmDelete(true)}
                          className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none"
                        >
                          {t('table.delete')}
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>

            <ConfirmDialog
              open={confirmRevoke}
              onOpenChange={setConfirmRevoke}
              title={t('table.confirmRevokeTitle')}
              description={t('table.confirmRevokeDesc')}
              confirmLabel={t('table.revoke')}
              cancelLabel={t('table.cancel')}
              onConfirm={handleRevoke}
              variant="destructive"
            />

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title={t('table.confirmDeleteTitle')}
              description={t('table.confirmDeleteDesc')}
              confirmLabel={t('table.delete')}
              cancelLabel={t('table.cancel')}
              onConfirm={handleDelete}
              variant="destructive"
            />
          </>
        )}
      </td>
    </tr>
  )
}

export function InvitationTable({ invitations, baseUrl }: Props) {
  const t = useTranslations('admin.invitations')

  if (invitations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        {t('table.noInvitations')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('table.title')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">{t('table.role')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">{t('table.email')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">{t('table.groups')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('table.status')}</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">{t('table.expires')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {invitations.map(inv => (
            <InviteRow key={inv.id} inv={inv} baseUrl={baseUrl} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
