'use client'

import { useState, useEffect, useCallback } from 'react'
import { Info } from 'lucide-react'
import { GroupInfoDrawer } from './group-info-drawer'
import { getGroupMembers } from '@/lib/use-cases/groups/info'

interface MemberInfo {
  displayName: string
  role: string
}

interface AppInfo {
  slug: string
  name: string
}

interface Props {
  groupName: string
  groupSlug: string
  groupId: string
  apps: AppInfo[]
}

export function GroupInfoButton({ groupName, groupSlug, groupId, apps }: Props) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<MemberInfo[]>([])

  const handleOpen = useCallback(() => {
    setOpen(true)
    if (members.length === 0) {
      getGroupMembers(groupId).then(setMembers).catch(() => {})
    }
  }, [groupId, members.length])

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        title="Información del grupo"
      >
        <Info size={18} />
      </button>
      <GroupInfoDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        groupName={groupName}
        groupSlug={groupSlug}
        members={members}
        apps={apps}
      />
    </>
  )
}
