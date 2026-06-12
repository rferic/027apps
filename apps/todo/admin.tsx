'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Loader2, Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'

interface TodoItem {
  id: string; title: string; description: string | null; priority: string;
  status: string; visibility: string; due_date: string | null;
  assigned_to: string | null; created_by: string; category_id: string | null;
  created_at: string; repeat_interval: string | null; group_id: string; updated_at: string;
}

interface Category {
  id: string; name: string; emoji: string; color: string;
}

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  urgent: { color: '#EF4444' },
  high: { color: '#F97316' },
  medium: { color: '#F59E0B' },
  low: { color: '#6B7280' },
}

export default function TodoAdmin() {
  const t = useTranslations('admin.todo')
  const tApp = useTranslations('apps.todo')
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: '', priority: '', status: '', visibility: '', assigned: '', group: '' })
  const [sort, setSort] = useState('updated')
  const [memberMap, setMemberMap] = useState<Map<string, string>>(new Map())
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [editItem, setEditItem] = useState<TodoItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editStatus, setEditStatus] = useState('pending')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editAssigned, setEditAssigned] = useState('')
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)

  function openEdit(item: TodoItem) {
    setEditItem(item)
    setEditTitle(item.title)
    setEditDesc(item.description || '')
    setEditPriority(item.priority)
    setEditStatus(item.status)
    setEditCategoryId(item.category_id || '')
    setEditDueDate(item.due_date ? item.due_date.slice(0, 10) : '')
    setEditAssigned(item.assigned_to || '')
  }

  async function saveEdit() {
    if (!editItem) return
    setSaving(true)
    const res = await fetch(`/api/v1/admin/apps/todo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editItem.id, title: editTitle.trim(), description: editDesc.trim(), priority: editPriority, status: editStatus, category_id: editCategoryId || null, due_date: editDueDate || null, assigned_to: editAssigned || null }),
    })
    setSaving(false)
    if (res.ok) { setEditItem(null); setRefresh(r => r + 1) }
    else toast.error('Failed to update')
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [todoRes, catRes, groupsRes] = await Promise.all([
        fetch('/api/v1/admin/apps/todo'),
        fetch('/api/v1/admin/apps/todo/categories'),
        fetch('/api/v1/admin/groups').then(r => r.json()).catch(() => []),
      ])
      const todoData = await todoRes.json()
      const catData = await catRes.json()
      const items: TodoItem[] = Array.isArray(todoData) ? todoData : todoData?.data ?? []
      setTodos(items)
      setCategories(Array.isArray(catData) ? catData : catData?.data ?? [])
      setGroups(Array.isArray(groupsRes) ? groupsRes : groupsRes?.data ?? [])

      // Fetch profiles for assigned users
      const userIds = [...new Set(items.filter(t => t.assigned_to).map(t => t.assigned_to!))]
      if (userIds.length > 0) {
        const profileRes = await fetch('/api/v1/admin/users').catch(() => null)
        if (profileRes?.ok) {
          const profiles = await profileRes.json()
          const list = Array.isArray(profiles) ? profiles : profiles?.data ?? []
          const map = new Map<string, string>()
          list.forEach((p: { id: string; displayName: string }) => { if (userIds.includes(p.id)) map.set(p.id, p.displayName) })
          setMemberMap(map)
        }
      }
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [refresh])

  const catMap = new Map(categories.map(c => [c.id, c]))

  async function handleDeleteTodo(id: string) {
    const res = await fetch(`/api/v1/admin/apps/todo?id=${id}`, { method: 'DELETE' })
    if (res.ok) setRefresh(r => r + 1)
    else toast.error('Failed to delete')
  }

  // Filter + sort locally
  const filtered = todos
    .filter(t => !filters.category || t.category_id === filters.category)
    .filter(t => !filters.priority || t.priority === filters.priority)
    .filter(t => !filters.status || t.status === filters.status)
    .filter(t => !filters.visibility || t.visibility === filters.visibility)
    .filter(t => !filters.assigned || t.assigned_to === filters.assigned)
    .filter(t => !filters.group || t.group_id === filters.group)
    .sort((a, b) => {
      if (sort === 'priority') {
        const p: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
        return (p[a.priority] ?? 0) - (p[b.priority] ?? 0)
      }
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'alpha') return a.title.localeCompare(b.title)
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    })

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filters.category} onChange={e => setFilters(f => ({...f, category: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer">
          <option value="">{tApp('filter_category')}</option>
          {categories.map(c => (<option key={c.id} value={c.id}>{c.emoji} {c.name}</option>))}
        </select>
        <select value={filters.priority} onChange={e => setFilters(f => ({...f, priority: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer">
          <option value="">{tApp('filter_priority')}</option>
          {Object.keys(PRIORITY_CONFIG).map(k => (<option key={k} value={k}>{tApp('priority_' + k)}</option>))}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer">
          <option value="">{tApp('filter_status')}</option>
          <option value="pending">{tApp('status_pending')}</option>
          <option value="done">{tApp('status_done')}</option>
        </select>
        <select value={filters.visibility} onChange={e => setFilters(f => ({...f, visibility: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer">
          <option value="">{tApp('visibility_label')}</option>
          <option value="public">{tApp('visibility_public')}</option>
          <option value="private">{tApp('visibility_private')}</option>
        </select>
        <select value={filters.assigned} onChange={e => setFilters(f => ({...f, assigned: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer">
          <option value="">{tApp('filter_assigned')}</option>
          <option value="null">{tApp('unassigned')}</option>
          {[...new Set(todos.filter(t => t.assigned_to).map(t => t.assigned_to!))].map(id => (
            <option key={id} value={id}>{memberMap.get(id) || id.slice(0, 8)}</option>
          ))}
        </select>
        {groups.length > 0 && (
        <select value={filters.group} onChange={e => setFilters(f => ({...f, group: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer">
          <option value="">{t('filter_group')}</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        )}
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-slate-200 bg-white text-slate-500 cursor-pointer ml-auto">
          <option value="updated">{tApp('sort_updated')}</option>
          <option value="priority">{tApp('sort_priority')}</option>
          <option value="alpha">{tApp('sort_alpha')}</option>
          <option value="oldest">{tApp('sort_oldest')}</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-200" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">{t('no_categories')}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const pc = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low
            const cat = item.category_id ? catMap.get(item.category_id) : null
            const isDone = item.status === 'done'
            return (
              <div key={item.id} className={`bg-white rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-colors ${isDone ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                  style={isDone ? { backgroundColor: '#10B981', borderColor: '#10B981' } : { borderColor: '#cbd5e1' }}>
                  {isDone && <Check size={14} strokeWidth={3} color="white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: pc.color + '20', color: pc.color }}>{tApp('priority_' + item.priority)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cat && <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: cat.color + '20', color: cat.color }}>{cat.emoji} {cat.name}</span>}
                    {item.due_date && <span className="text-[10px] text-slate-400">📅 {item.due_date.slice(0, 10)}</span>}
                    {!item.due_date && <span className="text-[10px] text-slate-300 italic">{tApp('no_date')}</span>}
                    <span className="text-[10px] text-slate-400">{tApp('status_' + item.status)}</span>
                  </div>
                </div>
                <button onClick={() => openEdit(item)} className="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDeleteTodo(item.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div className="fixed inset-0 bg-black/40" onClick={() => setEditItem(null)} />
          <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">{tApp('edit_title')}</h3>
              <button onClick={() => setEditItem(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Title" />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" rows={3} placeholder="Description" />
              <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                {Object.keys(PRIORITY_CONFIG).map(k => <option key={k} value={k}>{tApp('priority_' + k)}</option>)}
              </select>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                <option value="pending">{tApp('status_pending')}</option>
                <option value="done">{tApp('status_done')}</option>
              </select>
              <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                <option value="">{tApp('no_category')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
              <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              <input value={editAssigned} onChange={e => setEditAssigned(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="User ID (or empty to unassign)" />
              <button onClick={saveEdit} disabled={saving} className="w-full py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
