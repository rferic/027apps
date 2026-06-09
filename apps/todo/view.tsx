'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAppContext } from '@/lib/apps/context'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Plus, X, Loader2, UserPlus, Clock, AlertTriangle, Pencil, Trash2, Repeat } from 'lucide-react'

const supabase = createClient()

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
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
  groupSlug, categories, defaultCategoryId, initialDueDate, onClose, onCreated,
}: {
  groupSlug: string
  categories: Array<{ id: string; name: string; emoji: string; color: string }>
  defaultCategoryId?: string
  initialDueDate?: string
  onClose: () => void
  onCreated: () => void
}) {
  const t = useTranslations('apps.todo')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [dueDate, setDueDate] = useState(initialDueDate ?? today())
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '')
  const [repeatInterval, setRepeatInterval] = useState('')
  const [assignTo, setAssignTo] = useState('self')
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

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('create_title')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="create-title" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('title_placeholder')}</label>
            <input id="create-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} autoFocus required />
          </div>
          <div>
            <label htmlFor="create-desc" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('desc_placeholder')}</label>
            <textarea id="create-desc" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} rows={3} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="create-priority" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('priority')}</label>
              <select id="create-priority" value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{t('priority_' + k)}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="create-visibility" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('visibility_label')}</label>
              <select id="create-visibility" value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private')} className={inputCls}>
                <option value="private">{t('visibility_private')}</option>
                <option value="public">{t('visibility_public')}</option>
              </select>
            </div>
          </div>
          {visibility === 'public' && (
            <div>
              <label htmlFor="create-assign" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('assign_to')}</label>
              <select id="create-assign" value={assignTo} onChange={e => setAssignTo(e.target.value)} className={inputCls}>
                <option value="self">{t('assign_to_me')}</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="create-category" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('category')}</label>
            <select id="create-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">{t('no_category')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="create-date" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('due_date')}</label>
            <input id="create-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={today()} className={inputCls} />
          </div>
          <div>
            <label htmlFor="create-repeat" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('repeat_none')}</label>
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

function EditTodoModal({
  item, groupSlug, categories, onClose, onSaved,
}: {
  item: { id: string; title: string; description: string | null; priority: string; due_date: string | null; category_id: string | null; repeat_interval: string | null }
  groupSlug: string
  categories: Array<{ id: string; name: string; emoji: string; color: string }>
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('apps.todo')
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [priority, setPriority] = useState(item.priority)
  const [dueDate, setDueDate] = useState(item.due_date ? item.due_date.slice(0, 10) : '')
  const [categoryId, setCategoryId] = useState(item.category_id ?? '')
  const [repeatInterval, setRepeatInterval] = useState(item.repeat_interval ?? '')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setEditError(null)
    try {
      const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          due_date: dueDate || null,
          category_id: categoryId || null,
          repeat_interval: repeatInterval || null,
        }),
      })
      if (res.ok) { onSaved(); onClose(); return }
      const errBody = await res.text().catch(() => '')
      setEditError(errBody || 'Failed to save task')
    } catch {
      setEditError('Network error')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('edit_title')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('title_placeholder')}</label>
            <input id="edit-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} autoFocus required />
          </div>
          <div>
            <label htmlFor="edit-desc" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('desc_placeholder')}</label>
            <textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} rows={3} />
          </div>
          <div>
            <label htmlFor="edit-priority" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('priority')}</label>
            <select id="edit-priority" value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{t('priority_' + k)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="edit-category" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('category')}</label>
            <select id="edit-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">{t('no_category')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="edit-date" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('due_date')}</label>
            <input id="edit-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={today()} className={inputCls} />
          </div>
          <div>
            <label htmlFor="edit-repeat" className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">{t('repeat_none')}</label>
            <select id="edit-repeat" value={repeatInterval} onChange={e => setRepeatInterval(e.target.value)} className={inputCls}>
            <option value="">{t('repeat_none')}</option>
            <option value="weekly">{t('repeat_weekly')}</option>
            <option value="monthly">{t('repeat_monthly')}</option>
            <option value="yearly">{t('repeat_yearly')}</option>
          </select>
          </div>
          {editError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
          )}
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? t('saving') : t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DeleteConfirm ──────────────────────────────────────────────────────────

function DeleteConfirm({ item, groupSlug, onClose, onDeleted }: {
  item: TodoItem; groupSlug: string; onClose: () => void; onDeleted: () => void
}) {
  const t = useTranslations('apps.todo')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleDelete() {
    setDeleting(true)
    const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) { onDeleted(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('delete')}</h3>
        <p className="text-sm text-slate-500 mb-4">{t('delete_confirm')}</p>
        <p className="text-sm text-slate-700 mb-4 font-medium">&ldquo;{item.title}&rdquo;</p>
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

interface TodoItem {
  id: string; title: string; description: string | null; priority: string;
  status: string; visibility: string; due_date: string | null;
  assigned_to: string | null; created_by: string; category_id: string | null;
  created_at: string; repeat_interval: string | null; repeat_end_date: string | null;
}

interface Category {
  id: string; name: string; emoji: string; color: string; is_default?: boolean;
}

export default function TodoView() {
  const { groupSlug } = useAppContext()
  const t = useTranslations('apps.todo')
  const [tab, setTab] = useState<'my' | 'group'>('my')
  const [items, setItems] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<TodoItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<TodoItem | null>(null)
  const [filters, setFilters] = useState({ category: '', priority: '', status: '' })
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const [navDate, setNavDate] = useState(new Date())
  const [refresh, setRefresh] = useState(0)

  // Compute date range for current view
  function getDateRange() {
    const d = new Date(navDate)
    if (viewMode === 'day') {
      const s = d.toISOString().slice(0, 10)
      return { start: s, end: s }
    }
    if (viewMode === 'week') {
      const dow = d.getDay() === 0 ? 7 : d.getDay() // Monday=1, Sunday=7
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1)
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
      return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
    }
    if (viewMode === 'month') {
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
    }
    // year
    const first = new Date(d.getFullYear(), 0, 1)
    const last = new Date(d.getFullYear(), 11, 31)
    return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
  }

  function formatRangeHeader() {
    const d = new Date(navDate)
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    if (viewMode === 'day') return d.toLocaleDateString('es-ES', opts)
    if (viewMode === 'week') {
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1)
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
      return `${mon.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${sun.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    if (viewMode === 'month') return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return d.getFullYear().toString()
  }

  function navigate(dir: -1 | 1) {
    const d = new Date(navDate)
    if (viewMode === 'day') d.setDate(d.getDate() + dir)
    else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7)
    else if (viewMode === 'month') d.setMonth(d.getMonth() + dir)
    else d.setFullYear(d.getFullYear() + dir)
    setNavDate(d)
  }

  function goToday() { setNavDate(new Date()) }

  // Default due_date for "New task" based on current view
  function defaultDueDate() { return getDateRange().start }

  const fetchItems = useCallback(async () => {
    if (!groupSlug) return
    setLoading(true)
    try {
      const assigned = tab === 'my' ? 'me' : 'unassigned'
      const visibility = tab === 'group' ? 'public' : ''
      const params = new URLSearchParams({ assigned, sort: 'priority', limit: '50' })
      if (visibility) params.set('visibility', visibility)
      if (filters.category) params.set('category_id', filters.category)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.status) params.set('status', filters.status)
      const range = getDateRange()
      params.set('date_start', range.start)
      params.set('date_end', range.end)

      const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items?${params}`)
      if (!res.ok) throw new Error('Failed')
      const { data } = await res.json()
      setItems(data ?? [])
      setError(false)
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [groupSlug, tab, filters, viewMode, navDate])

  useEffect(() => { fetchItems() }, [fetchItems, refresh])

  useEffect(() => {
    if (groupSlug) fetchCategories(groupSlug).then(setCategories)
  }, [groupSlug])

  const catMap = new Map(categories.map(c => [c.id, c]))

  async function handleTake(item: TodoItem) {
    await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: 'self' }),
    })
    setRefresh(r => r + 1)
  }

  async function handleStatus(item: TodoItem, newStatus: string) {
    await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setRefresh(r => r + 1)
  }

  function formatDate(d: string | null) {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    if (date < now && date.toDateString() !== now.toDateString()) return '⚠ ' + date.toLocaleDateString(undefined, opts)
    if (date.toDateString() === now.toDateString()) return t('today')
    return date.toLocaleDateString(undefined, opts)
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{t('title')}</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={14} /> {t('new_todo')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-0.5">
        <button onClick={() => setTab('my')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <UserPlus size={14} className="inline mr-1" />{t('tab_my')}
        </button>
        <button onClick={() => setTab('group')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'group' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <CheckSquare size={14} className="inline mr-1" />{t('tab_group')}
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="p-1 text-slate-400 hover:text-slate-600 text-xs">&lt;</button>
          <button onClick={goToday} className="text-xs font-medium text-slate-600 hover:text-slate-900 px-1">{t('today')}</button>
          <button onClick={() => navigate(1)} className="p-1 text-slate-400 hover:text-slate-600 text-xs">&gt;</button>
          <span className="text-sm font-medium text-slate-700 ml-2">{formatRangeHeader()}</span>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {(['day','week','month','year'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t('view_' + m)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <TodoFilters categories={categories} filters={filters} onChange={setFilters} />

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-200" /></div>
      ) : error ? (
        <div className="text-center py-12 text-sm text-slate-400">{t('error_loading')}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">{tab === 'my' ? t('empty_my') : t('empty_group')}</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const pc = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low
            const isOverdue = item.due_date && new Date(item.due_date) < new Date()
            const cat = item.category_id ? catMap.get(item.category_id) : null
            return (
              <div key={item.id} className="bg-white rounded-lg border border-slate-100 p-3 hover:border-slate-200 transition-colors">
                <div className="flex items-start gap-3">
                  <button onClick={() => handleStatus(item, item.status === 'done' ? 'pending' : 'done')} className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.status === 'done' ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
                    {item.status === 'done' && <CheckSquare size={10} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: pc.color + '20', color: pc.color }}>{t('priority_' + item.priority)}</span>
                    </div>
                    {item.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {cat && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                          {cat.emoji} {cat.name}
                        </span>
                      )}
                      {item.due_date && (
                        <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{formatDate(item.due_date)}</span>
                      )}
                      {item.repeat_interval && (
                        <Repeat size={12} className="text-slate-300" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditItem(item)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100" title={t('edit')}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteItem(item)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title={t('delete')}>
                      <Trash2 size={14} />
                    </button>
                    {tab === 'group' && !item.assigned_to && (
                      <button onClick={() => handleTake(item)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium ml-1">{t('take')}</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateTodoModal groupSlug={groupSlug!} categories={categories} defaultCategoryId={categories.find(c => (c as any).is_default)?.id ?? ''} initialDueDate={defaultDueDate()} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefresh(r => r + 1) }} />}
      {editItem && <EditTodoModal item={editItem} groupSlug={groupSlug!} categories={categories} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); setRefresh(r => r + 1) }} />}
      {deleteItem && <DeleteConfirm item={deleteItem} groupSlug={groupSlug!} onClose={() => setDeleteItem(null)} onDeleted={() => { setDeleteItem(null); setRefresh(r => r + 1) }} />}
    </div>
  )
}
