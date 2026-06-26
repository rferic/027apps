'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

export interface EditItem {
  id: string; title: string; description: string | null; priority: string;
  due_date: string | null; category_id: string | null; repeat_interval: string | null;
  visibility?: string; assigned_to: string | null; status?: string;
}

export interface EditCategory {
  id: string; name: string; emoji: string; color: string;
}

export interface EditMember {
  user_id: string; display_name: string;
}

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  urgent: { color: '#EF4444' },
  high: { color: '#F97316' },
  medium: { color: '#F59E0B' },
  low: { color: '#6B7280' },
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  item: EditItem
  categories: EditCategory[]
  members?: EditMember[]
  showStatus?: boolean
  showRepeat?: boolean
  assigneeMode?: 'select' | 'input'
  onSave: (data: Record<string, any>) => Promise<void>
  onClose: () => void
}

export default function EditTodoModal({ item, categories, members = [], showStatus, showRepeat = true, assigneeMode = 'select', onSave, onClose }: Props) {
  const t = useTranslations('apps.todo')
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [priority, setPriority] = useState(item.priority)
  const [status, setStatus] = useState(item.status || 'pending')
  const [dueDate, setDueDate] = useState(item.due_date ? item.due_date.slice(0, 10) : '')
  const [categoryId, setCategoryId] = useState(item.category_id ?? '')
  const [repeatInterval, setRepeatInterval] = useState(item.repeat_interval ?? '')
  const [assignTo, setAssignTo] = useState(item.assigned_to || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        ...(showStatus ? { status } : {}),
        due_date: dueDate || null,
        category_id: categoryId || null,
        repeat_interval: repeatInterval || null,
        assigned_to: assignTo || null,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save')
    }
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-card'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-lg mx-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{t('edit_title')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-foreground mb-1.5">{t('title_placeholder')}</label>
            <input id="edit-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} autoFocus required />
          </div>
          <div>
            <label htmlFor="edit-desc" className="block text-sm font-medium text-foreground mb-1.5">{t('desc_placeholder')}</label>
            <textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} rows={3} />
          </div>
          <div>
            <label htmlFor="edit-priority" className="block text-sm font-medium text-foreground mb-1.5">{t('priority')}</label>
            <select id="edit-priority" value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k} style={{ color: v.color }}>{t('priority_' + k)}</option>)}
            </select>
          </div>
          {showStatus && (
          <div>
            <label htmlFor="edit-status" className="block text-sm font-medium text-foreground mb-1.5">{t('filter_status')}</label>
            <select id="edit-status" value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              <option value="pending">{t('status_pending')}</option>
              <option value="in_progress">{t('status_in_progress')}</option>
              <option value="done">{t('status_done')}</option>
              <option value="cancelled">{t('status_cancelled')}</option>
            </select>
          </div>
          )}
          <div>
            <label htmlFor="edit-category" className="block text-sm font-medium text-foreground mb-1.5">{t('category')}</label>
            <select id="edit-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">{t('no_category')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
          {item.visibility === 'public' && assigneeMode === 'select' && members.length > 0 && (
          <div>
            <label htmlFor="edit-assign" className="block text-sm font-medium text-foreground mb-1.5">{t('assign_to')}</label>
            <select id="edit-assign" value={assignTo} onChange={e => setAssignTo(e.target.value)} className={inputCls}>
              <option value="">{t('unassigned')}</option>
              {members.map(m => (<option key={m.user_id} value={m.user_id}>{m.display_name}</option>))}
            </select>
          </div>
          )}
          {assigneeMode === 'input' && (
          <div>
            <label htmlFor="edit-assign" className="block text-sm font-medium text-foreground mb-1.5">{t('assign_to')}</label>
            <input id="edit-assign" type="text" value={assignTo} onChange={e => setAssignTo(e.target.value)} className={inputCls} placeholder="User ID" />
          </div>
          )}
          <div>
            <label htmlFor="edit-date" className="block text-sm font-medium text-foreground mb-1.5">{t('due_date')}</label>
            <input id="edit-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={today()} className={inputCls} />
          </div>
          {showRepeat && (
          <div>
            <label htmlFor="edit-repeat" className="block text-sm font-medium text-foreground mb-1.5">{t('repeat_none')}</label>
            <select id="edit-repeat" value={repeatInterval} onChange={e => setRepeatInterval(e.target.value)} className={inputCls}>
              <option value="">{t('repeat_none')}</option>
              <option value="weekly">{t('repeat_weekly')}</option>
              <option value="monthly">{t('repeat_monthly')}</option>
              <option value="yearly">{t('repeat_yearly')}</option>
            </select>
          </div>
          )}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="pt-2 flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground hover:text-foreground">{t('cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? t('saving') : t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
