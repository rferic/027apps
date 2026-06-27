'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AdminUser } from '@/lib/use-cases/admin/users'
import { AdminUserActions } from './admin-user-actions'
import { EditUserModal } from '@/app/(admin)/[locale]/admin/users/EditUserModal'
import { PushTokensModal } from './push-tokens-modal'

interface Props {
  users: AdminUser[]
  currentUserId: string
  locale: string
  availableLocales: string[]
  groupCounts?: Map<string, number>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function AdminUserTable({ users, currentUserId, locale, availableLocales, groupCounts }: Props) {
  const t = useTranslations('admin.table')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [pushTokenUser, setPushTokenUser] = useState<AdminUser | null>(null)

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {t('noUsers')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('user')}
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
              {t('email')}
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('role')}
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
              {t('locale')}
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('groups')}
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
              Push
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
              {t('lastLogin')}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {users.map((user) => (
            <tr key={user.id} className={`bg-card hover:bg-muted transition-colors ${user.isBlocked ? 'opacity-60' : ''}`}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-slate-500">
                      {initials(user.displayName)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      <Link href={`/${locale}/admin/users/${user.id}`} className="hover:underline">
                        {user.displayName}
                      </Link>
                      {user.isBlocked && (
                        <span className="ml-2 text-[10px] font-semibold text-red-500 uppercase">{t('blockedBadge')}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                {user.locale ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-sm font-medium">
                {groupCounts?.get(user.id) ?? 0}
              </td>
              <td className="px-4 py-3 text-xs hidden lg:table-cell">
                <span className={`inline-flex items-center gap-1 font-medium ${
                  user.hasPushToken ? 'text-emerald-600' : 'text-slate-300'
                }`}>
                  {user.hasPushToken ? '✅ Active' : '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                {user.lastLoginAt ? formatRelative(user.lastLoginAt) : formatDate(user.joinedAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPushTokenUser(user)}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                  >
                    Push
                  </button>
                  <AdminUserActions user={user} locale={locale} currentUserId={currentUserId} onEdit={() => setEditingUser(user)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editingUser && (
        <EditUserModal
          user={editingUser}
          availableLocales={availableLocales}
          onClose={() => setEditingUser(null)}
        />
      )}
      {pushTokenUser && (
        <PushTokensModal
          userId={pushTokenUser.id}
          userName={pushTokenUser.displayName}
          onClose={() => setPushTokenUser(null)}
        />
      )}
    </div>
  )
}
