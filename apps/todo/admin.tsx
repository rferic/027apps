'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Loader2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'

interface Category {
  id: string; name: string; emoji: string; color: string; display_order: number
}

// ─── CreateCategoryModal ───────────────────────────────────────────────────

function CreateCategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t = useTranslations('admin.todo')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [color, setColor] = useState('#6B7280')
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
    const res = await fetch('/api/v1/admin/apps/todo/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), emoji, color }),
    })
    setSaving(false)
    if (res.ok) { onCreated(); onClose() } else { toast.error('Failed to create') }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('new_category')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('name')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} autoFocus required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Emoji</label>
              <input type="text" value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} className="w-16 px-2 py-2 text-sm border border-slate-200 rounded-lg text-center" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            </div>
          </div>
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? t('saving') : t('create')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Admin ────────────────────────────────────────────────────────────

export default function TodoAdmin() {
  const t = useTranslations('admin.todo')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/v1/admin/apps/todo/categories')
      .then(r => r.json())
      .then(data => setCategories(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [refresh])

  async function handleDelete(id: string) {
    const res = await fetch(`/api/v1/admin/apps/todo/categories/${id}`, { method: 'DELETE' })
    if (res.ok) setRefresh(r => r + 1); else toast.error('Failed to delete')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
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
              <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">{t('delete')}</button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateCategoryModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefresh(r => r + 1) }} />}
    </div>
  )
}
