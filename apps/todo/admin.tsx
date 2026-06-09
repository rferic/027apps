'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface TodoItem {
  id: string; title: string; description: string | null; priority: string;
  status: string; visibility: string; due_date: string | null;
  assigned_to: string | null; created_by: string; category_id: string | null;
  created_at: string; repeat_interval: string | null;
}

interface Category {
  id: string; name: string; emoji: string; color: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#6B7280',
}

export default function TodoAdmin() {
  const t = useTranslations('admin.todo')
  const tApp = useTranslations('apps.todo')
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [todosTotal, setTodosTotal] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/v1/admin/apps/todo').then(r => r.json()),
      fetch('/api/v1/admin/apps/todo/categories').then(r => r.json()),
    ])
      .then(([todoData, catData]) => {
        const items = Array.isArray(todoData) ? todoData : todoData?.data ?? []
        const cats = Array.isArray(catData) ? catData : catData?.data ?? []
        setTodos(items)
        setCategories(cats)
        setTodosTotal(items.length)
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [refresh])

  const catMap = new Map(categories.map(c => [c.id, c]))

  async function handleDeleteTodo(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/v1/admin/apps/todo?id=${id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) { setRefresh(r => r + 1); toast.success(t('delete') + ' OK') }
    else toast.error('Failed to delete')
  }

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">{t('todos_subtitle')} ({todosTotal} total)</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-200" /></div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">{t('no_categories')}</div>
      ) : (
        <div className="space-y-2">
          {todos.map(item => {
            const pc = PRIORITY_COLORS[item.priority] ?? '#6B7280'
            const cat = item.category_id ? catMap.get(item.category_id) : null
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-800">{item.title}</span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: pc + '20', color: pc }}>{tApp('priority_' + item.priority)}</span>
                    <span className="text-[10px] text-slate-400">{tApp('status_' + item.status)}</span>
                    {cat && (
                      <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: cat.color + '20', color: cat.color }}>{cat.emoji} {cat.name}</span>
                    )}
                    {item.due_date && (
                      <span className="text-[10px] text-slate-400">📅 {item.due_date.slice(0, 10)}</span>
                    )}
                    {item.assigned_to && (
                      <span className="text-[10px] text-slate-400">{tApp('assign_to_me')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTodo(item.id)}
                  disabled={deletingId === item.id}
                  className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
                >
                  {deletingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
