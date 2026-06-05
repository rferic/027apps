'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAppContext } from '@/lib/apps/context'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Plus, X, Loader2, UserPlus, Clock, AlertTriangle } from 'lucide-react'

const supabase = createClient()

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  return fetch(url, { ...options, headers, credentials: 'include' })
}

const PRIORITY_CONFIG: Record<string, { color: string; icon: typeof AlertTriangle; label: string }> = {
  urgent: { color: '#EF4444', icon: AlertTriangle, label: 'Urgent' },
  high: { color: '#F97316', icon: AlertTriangle, label: 'High' },
  medium: { color: '#F59E0B', icon: Clock, label: 'Medium' },
  low: { color: '#6B7280', icon: Clock, label: 'Low' },
}

const STATUS_OPTIONS = ['pending', 'in_progress', 'done', 'cancelled'] as const

// ─── CreateTodoModal ───────────────────────────────────────────────────────

function CreateTodoModal({ groupSlug, onClose, onCreated }: { groupSlug: string; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('apps.todo')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), priority, visibility, due_date: dueDate || null }),
    })
    setSaving(false)
    if (res.ok) { onCreated(); onClose() }
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
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('title_placeholder')} className={inputCls} autoFocus required />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('desc_placeholder')} className={inputCls} rows={3} />
          <div className="flex gap-3">
            <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private')} className={inputCls}>
              <option value="public">{t('visibility_public')}</option>
              <option value="private">{t('visibility_private')}</option>
            </select>
          </div>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? t('saving') : t('create')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main View ─────────────────────────────────────────────────────────────

interface TodoItem {
  id: string; title: string; description: string | null; priority: string;
  status: string; visibility: string; due_date: string | null;
  assigned_to: string | null; created_by: string; category_id: string | null;
  created_at: string;
}

export default function TodoView() {
  const { groupSlug } = useAppContext()
  const t = useTranslations('apps.todo')
  const [tab, setTab] = useState<'my' | 'group'>('my')
  const [items, setItems] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const fetchItems = useCallback(async () => {
    if (!groupSlug) return
    setLoading(true)
    try {
      const assigned = tab === 'my' ? 'me' : 'unassigned'
      const visibility = tab === 'group' ? 'public' : ''
      const params = new URLSearchParams({ assigned, sort: 'priority', limit: '50' })
      if (visibility) params.set('visibility', visibility)

      const res = await fetchWithAuth(`/api/v1/${groupSlug}/apps/todo/items?${params}`)
      if (!res.ok) throw new Error('Failed')
      const { data } = await res.json()
      setItems(data ?? [])
      setError(false)
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [groupSlug, tab])

  useEffect(() => { fetchItems() }, [fetchItems, refresh])

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
    if (date < now && date.toDateString() !== now.toDateString()) return '⚠ ' + date.toLocaleDateString()
    if (date.toDateString() === now.toDateString()) return 'Today'
    return date.toLocaleDateString()
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
            return (
              <div key={item.id} className="bg-white rounded-lg border border-slate-100 p-3">
                <div className="flex items-start gap-3">
                  <button onClick={() => handleStatus(item, item.status === 'done' ? 'pending' : 'done')} className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.status === 'done' ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
                    {item.status === 'done' && <CheckSquare size={10} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: pc.color + '20', color: pc.color }}>{item.priority}</span>
                    </div>
                    {item.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>}
                    {item.due_date && (
                      <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>{formatDate(item.due_date)}</p>
                    )}
                  </div>
                  {tab === 'group' && !item.assigned_to && (
                    <button onClick={() => handleTake(item)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex-shrink-0">{t('take')}</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreateTodoModal groupSlug={groupSlug!} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefresh(r => r + 1) }} />}
    </div>
  )
}
