'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { CheckSquare, Clock, AlertTriangle, ArrowRight, Loader2, UserPlus } from 'lucide-react'
import { useAppContext } from '@/lib/apps/context'

interface TodoItem {
  id: string
  title: string
  priority: string
  due_date: string | null
  status: string
  category_id: string | null
}

interface Category {
  id: string
  name: string
  emoji: string
  color: string
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#6B7280',
}

function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  const color = PRIORITY_COLORS[priority] ?? '#6B7280'
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: color + '20', color }}>
      {label}
    </span>
  )
}

function formatWidgetDate(d: string | null, t: ReturnType<typeof useTranslations<'apps.todo'>>): string {
  if (!d) return t('no_date')
  const date = new Date(d)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return t('today')
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const isOverdue = date < now
  return (isOverdue ? '⚠ ' : '') + date.toLocaleDateString(undefined, opts)
}

export default function TodoWidget() {
  const ctx = useAppContext()
  const [mounted, setMounted] = useState(false)
  const locale = useLocale()
  const t = useTranslations('apps.todo')
  const [myTasks, setMyTasks] = useState<TodoItem[]>([])
  const [groupTasks, setGroupTasks] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => { setMounted(true) }, [])

  const groupSlug = mounted
    ? (ctx.groupSlug ?? window.location.pathname.split('/')[2] ?? null)
    : null

  const catMap = new Map(categories.map(c => [c.id, c]))

  useEffect(() => {
    if (!mounted) return
    if (!groupSlug) { setLoading(false); return }

    const abort = new AbortController()

    Promise.all([
      fetch(`/api/v1/${groupSlug}/apps/todo/widget/my`, { credentials: 'include', signal: abort.signal }).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/${groupSlug}/apps/todo/widget/group`, { credentials: 'include', signal: abort.signal }).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/${groupSlug}/apps/todo/categories`, { credentials: 'include', signal: abort.signal }).then(r => r.ok ? r.json() : Promise.resolve([])).then(data => Array.isArray(data) ? data : (data?.data ?? [])),
    ])
      .then(([my, group, cats]) => {
        if (abort.signal.aborted) return
        setMyTasks(Array.isArray(my) ? my : [])
        setGroupTasks(Array.isArray(group) ? group : [])
        setCategories(cats as Category[])
        setLoading(false)
      })
      .catch(() => {
        if (!abort.signal.aborted) { setError(true); setLoading(false) }
      })

    return () => abort.abort()
  }, [groupSlug, refresh])

  async function handleTake(id: string) {
    await fetch(`/api/v1/${groupSlug}/apps/todo/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: 'self' }),
      credentials: 'include',
    })
    setRefresh(r => r + 1)
  }

  if (!groupSlug) {
    return <div className="p-4 text-center text-xs text-muted-foreground">{t('widget.not_available')}</div>
  }

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-muted" /></div>
  }

  if (error) {
    return <div className="p-4 text-center text-xs text-muted-foreground">{t('widget.couldnt_load')}</div>
  }

  const hasData = myTasks.length > 0 || groupTasks.length > 0
  if (!hasData) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <CheckSquare className="w-4 h-4" style={{ color: 'var(--app-primary)' }} />
          <h3 className="text-sm font-semibold text-foreground">{t('widget.heading')}</h3>
        </div>
        <p className="text-xs text-muted-foreground py-2 text-center">{t('widget.no_tasks')}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <CheckSquare className="w-4 h-4" style={{ color: 'var(--app-primary)' }} />
        <h3 className="text-sm font-semibold text-slate-700">{t('widget.heading')}</h3>
      </div>

      {/* My tasks */}
      {myTasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <UserPlus className="w-3.5 h-3.5" style={{ color: 'var(--app-primary)' }} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('widget.my_tasks')}</span>
          </div>
          <div className="space-y-1.5">
            {myTasks.map(item => {
              const cat = item.category_id ? catMap.get(item.category_id) : null
              return (
                <div key={item.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground truncate block">{item.title}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {cat && (
                        <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: cat.color + '20', color: cat.color }}>{cat.emoji} {cat.name}</span>
                      )}
                      {item.due_date && (
                        <span className={`text-[10px] ${new Date(item.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{formatWidgetDate(item.due_date, t)}</span>
                      )}
                    </div>

                  </div>
                  <PriorityBadge priority={item.priority} label={t('priority_' + item.priority)} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Group tasks */}
      {groupTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--app-primary)' }} />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('widget.group_tasks')}</span>
          </div>
          <div className="space-y-1.5">
            {groupTasks.map(item => {
              const cat = item.category_id ? catMap.get(item.category_id) : null
              return (
                <div key={item.id} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground truncate block">{item.title}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {cat && (
                        <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: cat.color + '20', color: cat.color }}>{cat.emoji} {cat.name}</span>
                      )}
                      {item.due_date && (
                        <span className={`text-[10px] ${new Date(item.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{formatWidgetDate(item.due_date, t)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <PriorityBadge priority={item.priority} label={t('priority_' + item.priority)} />
                    <button onClick={() => handleTake(item.id)} className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700">{t('assign_to_me')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Link href={`/${locale}/${groupSlug}/apps/todo`} className="flex items-center justify-center gap-1 text-xs font-medium mt-3 pt-3 border-t border-border" style={{ color: 'var(--app-primary)' }}>
        {t('widget.view_all')} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
