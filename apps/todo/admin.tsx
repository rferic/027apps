'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Category {
  id: string; name: string; emoji: string; color: string; display_order: number
}

interface TodoItem {
  id: string; title: string; description: string | null; priority: string;
  status: string; visibility: string; due_date: string | null;
  assigned_to: string | null; created_by: string; category_id: string | null;
  created_at: string;
}

// ─── CategoryForm (create/edit modal) ──────────────────────────────────────

function CategoryForm({ edit, onClose, onSaved }: {
  edit?: Category | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('admin.todo')
  const [name, setName] = useState(edit?.name ?? '')
  const [emoji, setEmoji] = useState(edit?.emoji ?? '📌')
  const [color, setColor] = useState(edit?.color ?? '#6B7280')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const url = edit
      ? `/api/v1/admin/apps/todo/categories/${edit.id}`
      : '/api/v1/admin/apps/todo/categories'
    const res = await fetch(url, {
      method: edit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), emoji, color }),
    })
    setSaving(false)
    if (res.ok) { onSaved(); onClose() }
    else { toast.error(edit ? 'Failed to update' : 'Failed to create') }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{edit ? t('edit_category') : t('new_category')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('name')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} autoFocus required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('emoji')}</label>
              <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} className="w-16 px-2 py-2 text-sm border border-slate-200 rounded-lg text-center" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('color_label')}</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            </div>
          </div>
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? t('saving') : (edit ? t('save') : t('create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Admin ────────────────────────────────────────────────────────────

export default function TodoAdmin() {
  const t = useTranslations('admin.todo')
  const [tab, setTab] = useState<'categories' | 'todos'>('categories')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Category | null>(null)
  const [deleteItemCount, setDeleteItemCount] = useState(0)
  const [refresh, setRefresh] = useState(0)

  const [groupSlug, setGroupSlug] = useState<string | null>(null)

  // ── Categories ──

  useEffect(() => {
    if (!groupSlug) return
    setLoading(true)
    fetch(`/api/v1/${groupSlug}/apps/todo/categories`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data?.data ?? []
        setCategories(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [groupSlug, refresh])

  async function handleDeleteCat(id: string) {
    const res = await fetch(`/api/v1/admin/apps/todo/categories/${id}`, { method: 'DELETE' })
    if (res.ok) { setRefresh(r => r + 1); return }

    if (res.status === 409) {
      try {
        const body = await res.json()
        const count = parseInt(body.fields?.count ?? '0', 10)
        const cat = categories.find(c => c.id === id)
        if (cat && count > 0) {
          setDeleteItemCount(count)
          setShowDeleteConfirm(cat)
          return
        }
      } catch { /* fall through to error toast */ }
    }

    toast.error('Failed to delete')
  }

  async function confirmForceDelete(id: string) {
    const res = await fetch(`/api/v1/admin/apps/todo/categories/${id}?force=true`, { method: 'DELETE' })
    if (res.ok) {
      setShowDeleteConfirm(null)
      setRefresh(r => r + 1)
    } else {
      toast.error('Failed to delete')
    }
  }

  // ── Todos ──
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loadingTodos, setLoadingTodos] = useState(false)
  const [todosPage, setTodosPage] = useState(1)
  const [todosTotal, setTodosTotal] = useState(0)

  useEffect(() => {
    if (groupSlug) return
    fetch('/api/v1/me')
      .then(r => r.json())
      .then(data => {
        if (data.groups?.length) setGroupSlug(data.groups[0].slug)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tab !== 'todos' || !groupSlug) return
    setLoadingTodos(true)
    fetch(`/api/v1/${groupSlug}/apps/todo/items?page=${todosPage}&limit=50`)
      .then(r => r.json())
      .then(res => {
        setTodos(res.data ?? [])
        setTodosTotal(res.pagination?.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoadingTodos(false))
  }, [tab, todosPage, groupSlug, refresh])

  async function handleDeleteTodo(id: string) {
    const res = await fetch(`/api/v1/${groupSlug}/apps/todo/items/${id}`, { method: 'DELETE' })
    if (res.ok) setRefresh(r => r + 1)
    else toast.error('Failed to delete')
  }

  const catMap = new Map(categories.map(c => [c.id, c]))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setTab('categories')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'categories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {t('title')}
        </button>
        <button onClick={() => setTab('todos')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === 'todos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {t('manage_todos')}
        </button>
      </div>

      {tab === 'categories' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditCat(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Plus size={14} /> {t('new_category')}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-200" /></div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">{t('no_categories')}</div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: cat.color + '20' }}>{cat.emoji}</div>
                  <span className="text-sm font-medium text-slate-700 flex-1">{cat.name}</span>
                  <button onClick={() => { setEditCat(cat); setShowForm(true) }} className="p-1 text-slate-400 hover:text-slate-600"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteCat(cat.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">{t('delete')}</button>
                </div>
              ))}
            </div>
          )}

          {showForm && <CategoryForm edit={editCat} onClose={() => { setShowForm(false); setEditCat(null) }} onSaved={() => { setShowForm(false); setEditCat(null); setRefresh(r => r + 1) }} />}

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="fixed inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(null)} />
              <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('delete_category_title')}</h3>
                <p className="text-sm text-slate-600 mb-6">
                  {t('delete_category_has_tasks', { count: deleteItemCount, name: showDeleteConfirm.name })}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => confirmForceDelete(showDeleteConfirm.id)}
                    className="w-full px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    {t('delete_category_delete_all')}
                  </button>
                  <button
                    onClick={() => confirmForceDelete(showDeleteConfirm.id)}
                    className="w-full px-4 py-2 text-sm font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    {t('delete_category_keep_tasks')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="w-full px-4 py-2 text-sm text-slate-500 rounded-lg hover:bg-slate-50"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'todos' && (
        <>
          <p className="text-sm text-slate-400 mb-4">{t('todos_subtitle')} ({todosTotal} total)</p>

          {loadingTodos ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-200" /></div>
          ) : todos.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">{t('no_categories')}</div>
          ) : (
            <div className="space-y-2">
              {todos.map(item => {
                const cat = item.category_id ? catMap.get(item.category_id) : null
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-800">{item.title}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">{item.priority}</span>
                        <span className="text-[10px] text-slate-400">{item.status}</span>
                        {cat && <span className="text-[10px] text-slate-400">{cat.emoji} {cat.name}</span>}
                        {item.assigned_to && <span className="text-[10px] text-slate-400">→ assigned</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteTodo(item.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
