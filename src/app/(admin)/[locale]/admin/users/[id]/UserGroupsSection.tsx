'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { addUserToGroupAction, removeUserFromGroupAction } from './actions'

interface GroupMembership {
  groupId: string
  groupName: string
  groupSlug: string
  role: string
}

interface AvailableGroup {
  id: string
  name: string
  slug: string
}

interface Props {
  userId: string
  currentGroups: GroupMembership[]
  availableGroups: AvailableGroup[]
}

export function UserGroupsSection({ userId, currentGroups: initialGroups, availableGroups: initialAvailable }: Props) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [currentGroups, setCurrentGroups] = useState(initialGroups)
  const [availableGroups, setAvailableGroups] = useState(initialAvailable)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedGroup = availableGroups.find(g => g.id === selectedGroupId)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    if (!dropdownOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [dropdownOpen])

  function handleAdd() {
    if (!selectedGroupId) return
    startTransition(async () => {
      const result = await addUserToGroupAction(userId, selectedGroupId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('users.user_added_to_group'))
        const group = availableGroups.find(g => g.id === selectedGroupId)
        if (group) {
          setCurrentGroups(prev => [...prev, { groupId: group.id, groupName: group.name, groupSlug: group.slug, role: 'member' }])
          setAvailableGroups(prev => prev.filter(g => g.id !== selectedGroupId))
        }
        setShowAdd(false)
        setSelectedGroupId('')
        router.refresh()
      }
    })
  }

  function handleRemove(groupId: string, groupName: string) {
    if (!confirm(t('users.remove_user_confirm', { group: groupName }))) return
    startTransition(async () => {
      const result = await removeUserFromGroupAction(userId, groupId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('users.user_removed_from_group'))
        const group = currentGroups.find(g => g.groupId === groupId)
        setCurrentGroups(prev => prev.filter(g => g.groupId !== groupId))
        if (group) {
          setAvailableGroups(prev => [...prev, { id: group.groupId, name: group.groupName, slug: group.groupSlug }])
        }
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      {currentGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('users.no_groups_warning')}</p>
      ) : (
        <div className="space-y-1">
          {currentGroups.map(g => (
            <div key={g.groupId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50">
              <div>
                <div className="text-sm font-medium text-foreground">{g.groupName}</div>
                <div className="text-xs text-muted-foreground">{g.groupSlug} · {g.role}</div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(g.groupId, g.groupName)}
                disabled={pending}
                className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
              >
{t('users.remove_from_group')}
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="flex gap-2 pt-3 border-t border-border">
          {/* Dropdown personalizado simulando un select estilizado */}
          <div ref={dropdownRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white flex items-center justify-between gap-2"
            >
              <span className={selectedGroup ? 'text-slate-700' : 'text-slate-400'}>
                {selectedGroup ? `${selectedGroup.name} (${selectedGroup.slug})` : t('users.select_group')}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                {availableGroups.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(g.id)
                      setDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${
                      g.id === selectedGroupId ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600'
                    }`}
                  >
                    {g.name} <span className="text-xs text-muted-foreground">({g.slug})</span>
                  </button>
                ))}
                {availableGroups.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t('users.no_available_groups')}</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={pending || !selectedGroupId}
            className="px-3 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? t('users.adding') : t('users.add')}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('users.cancel')}
          </button>
        </div>
      ) : availableGroups.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors pt-2"
        >
          + {t('users.add_to_group')}
        </button>
      ) : null}
    </div>
  )
}
