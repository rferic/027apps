'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users } from 'lucide-react'
import { EditGroupModal } from '@/app/(admin)/[locale]/admin/groups/[id]/EditGroupModal'
import { GroupDetailDrawer } from './GroupDetailDrawer'

interface GroupRow {
  id: string
  name: string
  slug: string
  created_at: string
  memberCount: number
  appCount: number
}

interface Props {
  groups: GroupRow[]
  locale: string
}

export function GroupsTable({ groups, locale }: Props) {
  const t = useTranslations('admin')
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<GroupRow | null>(null)

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('groups.empty')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('groups.table_name')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('groups.table_slug')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('groups.table_members')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('groups.table_private_apps')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('groups.table_created')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <tr key={group.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(group)}
                    className="text-sm font-medium text-slate-900 hover:text-slate-600 transition-colors cursor-pointer text-left"
                  >
                    {group.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 font-mono">{group.slug}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{group.memberCount}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{group.appCount}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {new Date(group.created_at).toLocaleDateString(locale)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setEditingGroup({ id: group.id, name: group.name, slug: group.slug })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('table.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingGroup && (
        <EditGroupModal
          isOpen={true}
          onClose={() => setEditingGroup(null)}
          groupId={editingGroup.id}
          currentName={editingGroup.name}
          currentSlug={editingGroup.slug}
        />
      )}

      {selectedGroup && (
        <GroupDetailDrawer
          key={selectedGroup.id}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
          groupSlug={selectedGroup.slug}
          isOpen={true}
          onOpenChange={(open) => { if (!open) setSelectedGroup(null) }}
          locale={locale}
        />
      )}
    </>
  )
}
