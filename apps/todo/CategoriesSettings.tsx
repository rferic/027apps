'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Loader2, Pencil, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Category {
  id: string; name: string; emoji: string; color: string; display_order: number; is_default?: boolean
}

function CategoryForm({ edit, onClose, onSaved }: {
  edit?: Category | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('admin.todo')
  const [name, setName] = useState(edit?.name ?? '')
  const [emoji, setEmoji] = useState(edit?.emoji ?? '📌')
  const [color, setColor] = useState(edit?.color ?? '#6B7280')
  const [showEmoji, setShowEmoji] = useState(false)
  const [saving, setSaving] = useState(false)

  const COMMON_EMOJIS = ['📌','🏠','🛒','🧹','🍳','🧺','📞','📋','🎯','🎂','💡','📝','⭐','❤️','🔧','🎓','💰','🚗','✈️','🏥','📚','🎵','🎮','🐾','✅','🎉','🔥','💬','👤','🌱','📅','⏰','🏷️','⚡']

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') { setShowEmoji(false); if (!showEmoji) onClose() } }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, showEmoji])

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
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('emoji')}</label>
                <button
                  type="button"
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="w-12 h-[42px] text-xl border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors flex items-center justify-center bg-white cursor-pointer"
                >
                  {emoji}
                </button>
                {showEmoji && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                    <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-20 grid grid-cols-8 gap-1 w-64">
                      {COMMON_EMOJIS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => { setEmoji(e); setShowEmoji(false) }}
                          className={`w-7 h-7 flex items-center justify-center text-base rounded-lg transition-all hover:scale-125 cursor-pointer ${
                            emoji === e ? 'bg-indigo-100 scale-110' : 'hover:bg-slate-100'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
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

export function CategoriesSettings() {
  const t = useTranslations('admin.todo')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [refresh, setRefresh] = useState(0)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/apps/todo/categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : data?.data ?? [])
    } catch { setCategories([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories, refresh])

  async function setDefault(id: string) {
    const res = await fetch(`/api/v1/admin/apps/todo/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_default: true }),
    })
    if (res.ok) setRefresh(r => r + 1)
    else toast.error('Failed to set default')
  }

  async function handleDelete(id: string, name: string, count: number) {
    const res = await fetch(`/api/v1/admin/apps/todo/categories/${id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const { fields } = await res.json()
      const confirmed = window.confirm(
        t('delete_category_has_tasks', { count: fields?.count ?? count, name })
      )
      if (confirmed) {
        await fetch(`/api/v1/admin/apps/todo/categories/${id}?force=true`, { method: 'DELETE' })
        setRefresh(r => r + 1)
      }
    } else if (res.ok) {
      setRefresh(r => r + 1)
    } else {
      toast.error(t('delete') + ' failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">{t('title')}</h2>
        <button onClick={() => { setEditCat(null); setShowForm(true) }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus size={13} /> {t('new_category')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{t('no_categories')}</p>
      ) : (
        <div className="space-y-1.5">
          {categories.map(cat => (
            <div key={cat.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${cat.is_default ? 'bg-indigo-50 border-l-2 border-indigo-400' : 'bg-slate-50'}`}>
              <span className="text-base">{cat.emoji}</span>
              <span className="text-sm text-slate-700 flex-1">{cat.name}</span>
              {cat.is_default ? (
                <button
                  onClick={() => setDefault(cat.id)}
                  title="Default"
                  className="p-1 rounded-md text-yellow-500 bg-yellow-50 transition-colors"
                >
                  <Star size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={() => setDefault(cat.id)}
                  title="Set as default"
                  className="p-1 rounded-md text-slate-300 hover:text-amber-400 hover:bg-amber-50 transition-colors group"
                >
                  <span className="block group-hover:hidden"><Star size={13} /></span>
                  <span className="hidden group-hover:block"><Star size={13} fill="currentColor" /></span>
                </button>
              )}
              <button onClick={() => { setEditCat(cat); setShowForm(true) }} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(cat.id, cat.name, 0)} className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {showForm && <CategoryForm edit={editCat} onClose={() => { setShowForm(false); setEditCat(null) }} onSaved={() => { setShowForm(false); setEditCat(null); setRefresh(r => r + 1) }} />}
    </div>
  )
}
