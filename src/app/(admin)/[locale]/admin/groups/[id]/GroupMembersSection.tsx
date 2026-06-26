'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { DsCheckbox } from '@/components/ds/checkbox'
import { addMembersAction, getAvailableUsersAction, removeMemberAction } from './actions'

interface Member {
  userId: string
  displayName: string
  email: string
  role: string
}

interface AvailableUser {
  id: string
  displayName: string
  email: string
}

interface Props {
  groupId: string
  members: Member[]
  onRefresh?: () => void
}

export function GroupMembersSection({ groupId, members: initialMembers, onRefresh }: Props) {
  const t = useTranslations('admin')
  const [members, setMembers] = useState(initialMembers)
  const prevRef = useRef(initialMembers)

  useEffect(() => {
    if (prevRef.current !== initialMembers) {
      prevRef.current = initialMembers
      setMembers(initialMembers)
    }
  }, [initialMembers])

  const [showAdd, setShowAdd] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const cancelledRef = useRef(false)

  function openAdd() {
    setShowAdd(true)
    setLoading(true)
    setAvailableUsers([])
    setFilter('')
    setSelected([])
  }

  function closeAdd() {
    setShowAdd(false)
    setSelected([])
    setFilter('')
  }

  useEffect(() => {
    if (!showAdd) return
    cancelledRef.current = false
    getAvailableUsersAction(groupId)
      .then(users => {
        if (!cancelledRef.current) {
          setAvailableUsers(users)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelledRef.current) {
          toast.error(t('common.error'))
          setLoading(false)
        }
      })
    return () => { cancelledRef.current = true }
  }, [showAdd, groupId, t])

  const filteredUsers = useMemo(() => {
    if (!filter.trim()) return availableUsers
    const q = filter.toLowerCase()
    return availableUsers.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  }, [availableUsers, filter])

  function toggleUser(userId: string) {
    setSelected(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  function handleAdd() {
    if (selected.length === 0) return
    setSaving(true)
    addMembersAction(groupId, selected)
      .then(result => {
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(t('groups.member_added'))
          closeAdd()
          onRefresh?.()
        }
      })
      .catch(() => toast.error(t('common.error')))
      .finally(() => setSaving(false))
  }

  function handleRemove(userId: string, name: string) {
    if (!confirm(t('groups.member_remove_confirm', { name }))) return
    removeMemberAction(groupId, userId)
      .then(result => {
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(t('groups.member_removed'))
          setMembers(prev => prev.filter(m => m.userId !== userId))
          onRefresh?.()
        }
      })
      .catch(() => toast.error(t('common.error')))
  }

  return (
    <div className="space-y-3">
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('groups.members_empty')}</p>
      ) : (
        <div className="space-y-1">
          {members.map(m => (
            <div key={m.userId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-foreground">{m.displayName}</div>
                <div className="text-xs text-muted-foreground">{m.email} · {m.role}</div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(m.userId, m.displayName)}
                className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                {t('groups.remove_member')}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={t('groups.search_users')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-card"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('groups.no_users_available')}</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-100 rounded-lg p-1">
              {filteredUsers.map(user => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <DsCheckbox checked={selected.includes(user.id)} onChange={() => toggleUser(user.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{user.displayName}</div>
                    <div className="text-xs text-slate-400 truncate">{user.email}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('groups.users_selected', { count: selected.length })}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || selected.length === 0}
              className="px-3 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {saving ? t('groups.wizard_add_member') : t('groups.add_members')}
            </button>
            <button
              type="button"
              onClick={closeAdd}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t('groups.wizard_cancel')}
            </button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button
          type="button"
          onClick={openAdd}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors pt-2"
        >
          + {t('groups.add_member')}
        </button>
      )}
    </div>
  )
}
