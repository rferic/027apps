'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Loader2, Check } from 'lucide-react'
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
  const [filters, setFilters] = useState({ category: '', priority: '', status: '', group: '' })
  const [sort, setSort] = useState('updated')
  const [refresh, setRefresh] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [todoRes, catRes] = await Promise.all([
        fetch('/api/v1/admin/apps/todo'),
        fetch('/api/v1/admin/apps/todo/categories'),
      ])
      const todoData = await todoRes.json()
      const catData = await catRes.json()
      setTodos(Array.isArray(todoData) ? todoData : todoData?.data ?? [])
      setCategories(Array.isArray(catData) ? catData : catData?.data ?? [])
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

  // Filter + sort locally (admin API returns all data)
  const filtered = todos
    .filter(t => !filters.category || t.category_id === filters.category)
    .filter(t => !filters.priority || t.priority === filters.priority)
    .filter(t => !filters.status || t.status === filters.status)
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
                <button onClick={() => handleDeleteTodo(item.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
