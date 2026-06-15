'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAppContext } from '@/lib/apps/context'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Loader2, Check, Circle, Clock, AlertTriangle, Pencil, UserPlus, Trash2, CheckSquare } from 'lucide-react'
import { TodoItemCard } from './TodoItemCard'
import type { TodoItem, Category } from './TodoItemCard'
import EditTodoModal, { type EditMember } from './EditTodoModal'

const supabase = createClient()

let cachedToken: string | null = null

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  if (cachedToken) {
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}), Authorization: `Bearer ${cachedToken}` }
    return fetch(url, { ...options, headers, credentials: 'include' })
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) cachedToken = session.access_token
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) }
  if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`
  return fetch(url, { ...options, headers, credentials: 'include' })
}

async function fetchCategories(groupSlug: string): Promise<Array<{ id: string; name: string; emoji: string; color: string }>> {
  try {
    const res = await fetch(`/api/v1/${groupSlug}/apps/todo/categories`, { credentials: 'include' })
    if (res.ok) {
      const result = await res.json()
      return Array.isArray(result) ? result : (result?.data ?? [])
    }
    console.warn('[todo] fetchCategories not ok:', res.status, await res.text().catch(() => ''))
  } catch (e) { console.error('[todo] fetchCategories error:', e) }
  return []
}

async function fetchGroupMembers(groupSlug: string): Promise<Array<{ user_id: string; display_name: string }>> {
  try {
    const res = await fetch(`/api/v1/${groupSlug}/members`, { credentials: 'include' })
    if (res.ok) {
      const result = await res.json()
      return Array.isArray(result) ? result : (result?.data ?? [])
    }
  } catch {}
  return []
}

const PRIORITY_CONFIG: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  urgent: { color: '#EF4444', icon: AlertTriangle },
  high: { color: '#F97316', icon: AlertTriangle },
  medium: { color: '#F59E0B', icon: Clock },
  low: { color: '#6B7280', icon: Clock },
}

// ─── TodoFilters ───────────────────────────────────────────────────────────

function TodoFilters({
  categories, filters, onChange,
}: {
  categories: Array<{ id: string; name: string; emoji: string; color: string }>
  filters: { category: string; priority: string; status: string }
  onChange: (f: typeof filters) => void
}) {
  const t = useTranslations('apps.todo')

  function set(key: string, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const selectCls = 'px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400'

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <select value={filters.category} onChange={e => set('category', e.target.value)} className={selectCls}>
        <option value="">{t('all')} {t('filter_category')}</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
        ))}
      </select>
      <select value={filters.priority} onChange={e => set('priority', e.target.value)} className={selectCls}>
        <option value="">{t('all')} {t('filter_priority')}</option>
        {Object.keys(PRIORITY_CONFIG).map(k => (
          <option key={k} value={k}>{t('priority_' + k)}</option>
        ))}
      </select>
      <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls}>
        <option value="">{t('all')} {t('filter_status')}</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  )
}

// ─── CreateTodoModal ───────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function CreateTodoModal({
  groupSlug, categories, defaultCategoryId, initialDueDate, defaultVisibility, onClose, onCreated,
}: {
  groupSlug: string
  categories: Array<{ id: string; name: string; emoji: string; color: string }>
  defaultCategoryId?: string
  initialDueDate?: string
  defaultVisibility?: 'public' | 'private'
  onClose: () => void
  onCreated: () => void
}) {
  const t = useTranslations('apps.todo')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [visibility, setVisibility] = useState<'public' | 'private'>(defaultVisibility ?? 'private')
  const [dueDate, setDueDate] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '')
  const [repeatInterval, setRepeatInterval] = useState('')
  const [assignTo, setAssignTo] = useState('')
  const [members, setMembers] = useState<Array<{ user_id: string; display_name: string }>>([])
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (visibility === 'public' && members.length === 0) {
      fetch(`/api/v1/${groupSlug}/apps/todo/members`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => setMembers(Array.isArray(data) ? data : (data?.data ?? [])))
        .catch(() => {})
    }
  }, [visibility, groupSlug, members.length])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setCreateError(null)
    try {
      const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          visibility,
          due_date: dueDate || null,
          category_id: categoryId || null,
          repeat_interval: repeatInterval || null,
          assigned_to: assignTo || undefined,
        }),
      })
      if (res.ok) { onCreated(); onClose(); return }
      const errBody = await res.text().catch(() => '')
      setCreateError(errBody || 'Failed to create task')
    } catch {
      setCreateError('Network error')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('create_title')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="create-title" className="block text-sm font-medium text-slate-700 mb-1.5">{t('title_placeholder')} <span className="text-red-400">*</span></label>
            <input id="create-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} autoFocus required />
          </div>
          <div>
            <label htmlFor="create-desc" className="block text-sm font-medium text-slate-700 mb-1.5">{t('desc_placeholder')} <span className="text-slate-400 font-normal normal-case tracking-normal ml-0.5">(opcional)</span></label>
            <textarea id="create-desc" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} rows={3} />
          </div>
          <div>
            <label htmlFor="create-category" className="block text-sm font-medium text-slate-700 mb-1.5">{t('category')}</label>
            <select id="create-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">{t('no_category')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="create-priority" className="block text-sm font-medium text-slate-700 mb-1.5">{t('priority')}</label>
            <select id="create-priority" value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k} style={{ color: v.color }}>{t('priority_' + k)}</option>)}
            </select>
          </div>
          {visibility === 'public' ? (
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="create-visibility" className="block text-sm font-medium text-slate-700 mb-1.5">{t('visibility_label')}</label>
                <select id="create-visibility" value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private')} className={inputCls}>
                  <option value="private">{t('visibility_private')}</option>
                  <option value="public">{t('visibility_public')}</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="create-assign" className="block text-sm font-medium text-slate-700 mb-1.5">{t('assign_to')}</label>
                <select id="create-assign" value={assignTo} onChange={e => setAssignTo(e.target.value)} className={inputCls}>
                  <option value="">{t('unassigned')}</option>
                  <option value="self">{t('assign_to_me')}</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="create-visibility" className="block text-sm font-medium text-slate-700 mb-1.5">{t('visibility_label')}</label>
              <select id="create-visibility" value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private')} className={inputCls}>
                <option value="private">{t('visibility_private')}</option>
                <option value="public">{t('visibility_public')}</option>
              </select>
            </div>
          )}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              {t('due_date')}
              <label className="flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal text-slate-400 cursor-pointer">
                <input type="checkbox" checked={!dueDate} onChange={e => setDueDate(e.target.checked ? '' : (initialDueDate ?? today()))} className="w-4 h-4 sm:w-3 sm:h-3 rounded" />
                {t('no_date')}
              </label>
            </label>
            <input id="create-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={today()} disabled={!dueDate} className={inputCls} />
          </div>
          <div>
            <label htmlFor="create-repeat" className="block text-sm font-medium text-slate-700 mb-1.5">{t('repeat_none')}</label>
            <select id="create-repeat" value={repeatInterval} onChange={e => setRepeatInterval(e.target.value)} className={inputCls}>
              <option value="">{t('repeat_none')}</option>
              <option value="weekly">{t('repeat_weekly')}</option>
              <option value="monthly">{t('repeat_monthly')}</option>
              <option value="yearly">{t('repeat_yearly')}</option>
            </select>
          </div>
          {createError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{createError}</p>
          )}
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? t('saving') : t('create')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── EditTodoModal ─────────────────────────────────────────────────────────

// ─── DeleteConfirm ──────────────────────────────────────────────────────────

function DeleteConfirm({ item, groupSlug, onClose, onDeleted }: {
  item: TodoItem; groupSlug: string; onClose: () => void; onDeleted: () => void
}) {
  const t = useTranslations('apps.todo')
  const [deleting, setDeleting] = useState(false)
  const [deleteSeries, setDeleteSeries] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleDelete() {
    setDeleting(true)
    const params = deleteSeries ? '?delete_series=true' : ''
    const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}${params}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { onDeleted(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('delete')}</h3>
        <p className="text-sm text-slate-500 mb-1">{t('delete_confirm')}</p>
        <p className="text-sm text-slate-700 mb-4 font-medium">&ldquo;{item.title}&rdquo;</p>
        {item.repeat_interval && (
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={deleteSeries} onChange={e => setDeleteSeries(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-xs text-slate-500">{t('delete_series')}</span>
        </label>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">{t('cancel')}</button>
          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? t('saving') : t('delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main View ─────────────────────────────────────────────────────────────

export default function TodoView() {
  const { groupSlug } = useAppContext()
  const t = useTranslations('apps.todo')
  const locale = useLocale()
  const [tab, setTab] = useState<'my' | 'group'>('my')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('todo-tab')
      if (saved === 'group') setTab('group')
    } catch {}
  }, [])

  function changeTab(t: 'my' | 'group') {
    setTab(t)
    try { localStorage.setItem('todo-tab', t) } catch {}
  }
  const [items, setItems] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(!categories.length)
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<TodoItem | null>(null)
  const [editMembers, setEditMembers] = useState<EditMember[]>([])
  const [deleteItem, setDeleteItem] = useState<TodoItem | null>(null)
  const [detailItem, setDetailItem] = useState<TodoItem | null>(null)
  const [filters, setFilters] = useState<{category:string;priority:string;status:string;assigned:string}>({ category: '', priority: '', status: '', assigned: '' })
  const [sort, setSort] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('todo-sort') || 'upcoming'
    }
    return 'upcoming'
  })

  useEffect(() => {
    localStorage.setItem('todo-sort', sort)
  }, [sort])
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const [navDate, setNavDate] = useState(new Date())
  const [showFilters, setShowFilters] = useState(false)
  const clearFilters = () => setFilters({ category: '', priority: '', status: '', assigned: '' })
  const [refresh, setRefresh] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id)
    })
  }, [])
  useEffect(() => {
    if (!groupSlug) return
    let cancelled = false
    setLoading(true)
    setError(false)
    Promise.all([
      fetch(`/api/v1/${groupSlug}/apps/todo/categories`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/${groupSlug}/apps/todo/items?sort=${sort}&page=1&limit=50`, { credentials: 'include' }).then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([catsResult, itemsResult]) => {
      if (cancelled) return
      const cats = Array.isArray(catsResult) ? catsResult : (catsResult?.data ?? [])
      const its = Array.isArray(itemsResult) ? itemsResult : (itemsResult?.data ?? [])
      setCategories(cats)
      setItems(its)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) { setError(true); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [groupSlug, refresh, sort])
  const catMap = new Map(categories.map(c => [c.id, c]))

  const [memberMap, setMemberMap] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (groupSlug) {
      fetch(`/api/v1/${groupSlug}/apps/todo/members`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.data ?? [])
          setMemberMap(new Map(list.map((m: { user_id: string; display_name: string }) => [m.user_id, m.display_name])))
        })
        .catch(() => {})
    }
  }, [groupSlug])

  async function handleStatus(item: TodoItem, newStatus: string) {
    await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setRefresh(r => r + 1)
  }

  async function handleAssignToMe(item: TodoItem) {
    await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: userId }),
    })
    setRefresh(r => r + 1)
  }

  function getDateRange() {
    const d = new Date(navDate)
    if (viewMode === 'day') {
      const s = d.toISOString().slice(0, 10)
      return { start: s, end: s }
    }
    if (viewMode === 'week') {
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1)
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
      return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
    }
    if (viewMode === 'month') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
    }
    const first = new Date(d.getFullYear(), 0, 1)
    const last = new Date(d.getFullYear(), 11, 31)
    return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(navDate)
    if (viewMode === 'day') d.setDate(d.getDate() + dir)
    else if (viewMode === 'week') d.setDate(d.getDate() + 7 * dir)
    else if (viewMode === 'month') d.setMonth(d.getMonth() + dir)
    else if (viewMode === 'year') d.setFullYear(d.getFullYear() + dir)
    setNavDate(d)
  }

  function goToday() { setNavDate(new Date()) }

  function formatRangeHeader() {
    const { start, end } = getDateRange()
    if (start === end) return new Date(start + 'T12:00:00').toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
    const s = new Date(start + 'T12:00:00')
    const e = new Date(end + 'T12:00:00')
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
      return s.toLocaleDateString(locale, { month: 'long' }) + ' ' + s.getDate() + ' – ' + e.getDate() + ', ' + s.getFullYear()
    return s.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ' – ' + e.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function defaultDueDate() { return getDateRange().start }

  function formatDate(d: string | null) {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    if (date < now && date.toDateString() !== now.toDateString()) return '⚠ ' + date.toLocaleDateString(locale, opts)
    if (date.toDateString() === now.toDateString()) return t('today')
    return date.toLocaleDateString(locale, opts)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4F46E5', color: '#fff' }}>
            <CheckSquare size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
            <p className="text-xs text-slate-400">{items.length} tareas</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors" style={{ backgroundColor: '#4F46E5' }}>
          <Plus size={14} /> {t('new_todo')}
        </button>
      </div>

      {/* Tabs + Sort */}
      <div className="flex items-center sm:justify-between justify-center mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => changeTab('my')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'my' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('tab_my')}</button>
          <button onClick={() => changeTab('group')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === 'group' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('tab_group')}</button>
        </div>
      </div>

      {/* Filters - same pattern on all sizes: button + modal + active badges */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowFilters(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/></svg>
            {t('filter_label')}
            {Object.values(filters).some(v => v) && (
              <span className="ml-1 size-1.5 rounded-full bg-indigo-500" />
            )}
          </button>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="updated">{t('sort_updated')}</option>
            <option value="priority">{t('sort_priority')}</option>
            <option value="upcoming">{t('sort_upcoming')}</option>
            <option value="alpha">{t('sort_alpha')}</option>
            <option value="newest">{t('sort_newest')}</option>
            <option value="oldest">{t('sort_oldest')}</option>
          </select>
        </div>
        {/* Active filter badges */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {filters.category && catMap.get(filters.category) && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: (catMap.get(filters.category)!.color || '#6B7280') + '18', color: catMap.get(filters.category)!.color || '#6B7280' }}>
            {catMap.get(filters.category)!.emoji} {catMap.get(filters.category)!.name}
            <button type="button" onClick={() => setFilters(f => ({...f, category: ''}))} className="cursor-pointer opacity-60 hover:opacity-100"><X size={12} /></button>
          </span>
          )}
          {filters.priority && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: (PRIORITY_CONFIG[filters.priority]?.color || '#6B7280') + '18', color: PRIORITY_CONFIG[filters.priority]?.color || '#6B7280' }}>
            {t('priority_' + filters.priority)}
            <button type="button" onClick={() => setFilters(f => ({...f, priority: ''}))} className="cursor-pointer opacity-60 hover:opacity-100"><X size={12} /></button>
          </span>
          )}
          {filters.status && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: filters.status === 'done' ? '#10B98118' : '#6B728018', color: filters.status === 'done' ? '#10B981' : '#6B7280' }}>
            {filters.status === 'done' ? <Check size={11} strokeWidth={3} /> : <Circle size={11} />}
            {t('status_' + filters.status)}
            <button type="button" onClick={() => setFilters(f => ({...f, status: ''}))} className="cursor-pointer opacity-60 hover:opacity-100"><X size={12} /></button>
          </span>
          )}
          {tab === 'group' && filters.assigned && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            👤 {filters.assigned === 'unassigned' ? t('unassigned') : memberMap.get(filters.assigned) ?? filters.assigned}
            <button type="button" onClick={() => setFilters(f => ({...f, assigned: ''}))} className="cursor-pointer opacity-60 hover:opacity-100"><X size={12} /></button>
          </span>
          )}
        </div>
        {/* Filter modal - same on all sizes */}
        {showFilters && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowFilters(false)}>
            <div className="relative bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-slate-900">{t('filter_label')}</h3>
                <button type="button" onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={20} /></button>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filter_category')}</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilters(f => ({...f, category: ''}))}
                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${!filters.category ? 'bg-slate-800 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('all')}</button>
                  {categories.map(c => (
                    <button key={c.id} type="button" onClick={() => setFilters(f => ({...f, category: f.category === c.id ? '' : c.id}))}
                      className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${filters.category === c.id ? 'text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      style={filters.category === c.id ? { backgroundColor: c.color } : {}}>{c.emoji} {c.name}</button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filter_priority')}</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilters(f => ({...f, priority: ''}))}
                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${!filters.priority ? 'bg-slate-800 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('all')}</button>
                  {Object.keys(PRIORITY_CONFIG).map(k => (
                    <button key={k} type="button" onClick={() => setFilters(f => ({...f, priority: f.priority === k ? '' : k}))}
                      className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${filters.priority === k ? 'text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      style={filters.priority === k ? { backgroundColor: PRIORITY_CONFIG[k].color } : {}}>{t('priority_' + k)}</button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filter_status')}</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilters(f => ({...f, status: ''}))}
                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${!filters.status ? 'bg-slate-800 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('all')}</button>
                  {['pending', 'done'].map(s => (
                    <button key={s} type="button" onClick={() => setFilters(f => ({...f, status: f.status === s ? '' : s}))}
                      className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${filters.status === s ? 'bg-slate-800 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('status_' + s)}</button>
                  ))}
                </div>
              </div>
              {tab === 'group' && (
              <div className="mb-5">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('filter_assigned')}</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFilters(f => ({...f, assigned: ''}))}
                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${!filters.assigned ? 'bg-slate-800 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('all')}</button>
                  <button type="button" onClick={() => setFilters(f => ({...f, assigned: f.assigned === 'unassigned' ? '' : 'unassigned'}))}
                    className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${filters.assigned === 'unassigned' ? 'bg-slate-800 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('unassigned')}</button>
                  {Array.from(memberMap.entries()).map(([id, name]) => (
                    <button key={id} type="button" onClick={() => setFilters(f => ({...f, assigned: f.assigned === id ? '' : id}))}
                      className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${filters.assigned === id ? 'bg-indigo-600 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{name}</button>
                  ))}
                </div>
              </div>
              )}
              <button type="button" onClick={() => setShowFilters(false)}
                className="w-full py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl cursor-pointer hover:bg-indigo-700 shadow-sm transition-colors">{t('apply')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Date navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center justify-center sm:justify-start gap-1 min-w-0">
          <button onClick={() => navigate(-1)} className="p-1 text-slate-400 hover:text-slate-600 text-sm flex-shrink-0">&lt;</button>
          <button onClick={goToday} className="text-sm font-medium text-slate-700 hover:text-slate-900 px-2 truncate">{formatRangeHeader()}</button>
          <button onClick={() => navigate(1)} className="p-1 text-slate-400 hover:text-slate-600 text-sm flex-shrink-0">&gt;</button>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 flex-shrink-0 mx-auto sm:mx-0">
          {(['day','week','month','year'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t('view_' + m)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-200" /></div>
      ) : error ? (
        <div className="text-center py-12 text-sm text-slate-400">{t('error_loading')}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">{tab === 'my' ? t('empty_my') : t('empty_group')}</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <TodoItemCard
              key={item.id}
              item={item}
              categories={categories}
              memberMap={memberMap}
              userId={userId}
              showAssign={tab === 'group'}
              onStatusChange={handleStatus}
              onEdit={(item) => setEditItem(item)}
              onDelete={(item) => setDeleteItem(item)}
              onDetail={(item) => setDetailItem(item)}
              onAssign={handleAssignToMe}
            />
          ))}
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDetailItem(null)} />
          <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900 pr-4">{detailItem.title}</h3>
              <button onClick={() => setDetailItem(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 -mt-1 -mr-1"><X size={16} /></button>
            </div>
            {detailItem.description && <p className="text-sm text-slate-600 mb-3">{detailItem.description}</p>}
            <div className="space-y-1.5 text-xs text-slate-500 mb-4">
              {(() => {
                const dc = detailItem.category_id ? catMap.get(detailItem.category_id) : null
                return dc ? <p><span className="font-medium">{dc.emoji}</span> <span style={{ color: dc.color }}>{dc.name}</span></p> : null
              })()}
              <p><span className="font-medium text-slate-600">{t('priority')}:</span> <span className="font-semibold px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: PRIORITY_CONFIG[detailItem.priority]?.color + '20' || '#6B728020', color: PRIORITY_CONFIG[detailItem.priority]?.color || '#6B7280' }}>{t('priority_' + detailItem.priority)}</span></p>
              <p><span className="font-medium text-slate-600">{t('filter_status')}:</span> {t('status_' + detailItem.status)}</p>
              {detailItem.due_date && <p><span className="font-medium text-slate-600">{t('due_date')}:</span> {formatDate(detailItem.due_date)}</p>}
              {!detailItem.due_date && <p className="italic">{t('no_date')}</p>}
              {detailItem.repeat_interval && <p>↻ {t('repeat_' + detailItem.repeat_interval)}</p>}
              {detailItem.assigned_to && <p><span className="font-medium text-slate-600">{t('assign_to')}:</span> 👤 {memberMap.get(detailItem.assigned_to) ?? '...'}</p>}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <button onClick={() => { setDetailItem(null); setEditItem(detailItem) }} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title={t('edit')}>
                  <Pencil size={16} />
                </button>
                {tab === 'group' && !detailItem.assigned_to && userId && (
                  <button onClick={() => { handleAssignToMe(detailItem); setDetailItem(null) }} className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors" title={t('assign_to_me')}>
                    <UserPlus size={16} />
                  </button>
                )}
              </div>
              <button onClick={() => { setDetailItem(null); setDeleteItem(detailItem) }} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title={t('delete')}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && <CreateTodoModal groupSlug={groupSlug!} categories={categories} defaultCategoryId={categories.find(c => c.is_default)?.id ?? ''} initialDueDate={defaultDueDate()} defaultVisibility={tab === 'group' ? 'public' : 'private'} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefresh(r => r + 1) }} />}
      {editItem && (
        <EditTodoModal
          item={editItem}
          categories={categories}
          members={editMembers}
          showRepeat
          onSave={async (data) => {
            const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${editItem.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
            if (!res.ok) {
              const err = await res.text().catch(() => 'Failed to save')
              throw new Error(err)
            }
            setRefresh(r => r + 1)
          }}
          onClose={() => setEditItem(null)}
        />
      )}
      {deleteItem && <DeleteConfirm item={deleteItem} groupSlug={groupSlug!} onClose={() => setDeleteItem(null)} onDeleted={() => { setDeleteItem(null); setRefresh(r => r + 1) }} />}
    </div>
  )
}
