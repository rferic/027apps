'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Plus, Check, Users, Shield } from 'lucide-react'

interface GroupInfo {
  id: string
  name: string
  slug: string
  role: string
  memberCount?: number
}

interface Props {
  locale: string
  groups: GroupInfo[]
  currentGroupSlug?: string | null
  isAdmin: boolean
}

function setLastGroupCookie(slug: string) {
  document.cookie = `last_group=${slug};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function GroupSwitcher({ locale, groups, currentGroupSlug, isAdmin }: Props) {
  const t = useTranslations('groups')
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  const segments = pathname.split('/').filter(Boolean)
  const slugFromUrl =
    segments.length >= 2 && segments[1] !== 'login' && segments[1] !== 'profile'
      ? segments[1]
      : null

  const effectiveSlug =
    (slugFromUrl && groups.some(g => g.slug === slugFromUrl) ? slugFromUrl : null) ??
    (currentGroupSlug && groups.some(g => g.slug === currentGroupSlug) ? currentGroupSlug : null) ??
    groups[0]?.slug ??
    null

  const currentGroup = groups.find(g => g.slug === effectiveSlug)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (groups.length <= 1 && !isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-emerald-600">
            {initials(currentGroup?.name ?? groups[0]?.name ?? '?')}
          </span>
        </div>
        <span className="text-sm font-medium text-slate-700">
          {currentGroup?.name ?? groups[0]?.name ?? t('fallback')}
        </span>
      </div>
    )
  }

  function handleSelect(slug: string) {
    setLastGroupCookie(slug)
    setOpen(false)
    router.push(`/${locale}/${slug}/dashboard`)
  }

  function handleCreateGroup() {
    setOpen(false)
    router.push(`/${locale}/admin/groups/new`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-emerald-600">
            {initials(currentGroup?.name ?? groups[0]?.name ?? '?')}
          </span>
        </div>
        <span className="max-w-[100px] truncate text-sm font-medium text-slate-700">
          {currentGroup?.name ?? groups[0]?.name ?? t('fallback')}
        </span>
        {currentGroup?.role === 'admin' && (
          <Shield className="w-3 h-3 text-amber-500 flex-shrink-0" />
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-100 shadow-lg py-1 z-50">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t('switcher_label')}
          </p>
          {groups.map(group => {
            const isActive = group.slug === effectiveSlug
            const memberLabel = group.memberCount != null
              ? `${group.memberCount} ${group.memberCount === 1 ? t('member_singular') : t('member_plural')}`
              : ''
            return (
              <button
                key={group.id}
                onClick={() => handleSelect(group.slug)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                  isActive ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-emerald-600">
                    {initials(group.name)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-medium truncate">{group.name}</span>
                    {group.role === 'admin' && (
                      <Shield className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    {memberLabel && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {memberLabel}
                      </span>
                    )}
                  </div>
                </div>
                {isActive && (
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                )}
              </button>
            )
          })}
          
          {isAdmin && (
            <>
              <hr className="my-1 border-slate-100" />
              <button
                onClick={handleCreateGroup}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('create_group')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
