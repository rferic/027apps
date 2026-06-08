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

export default function TodoAdmin() {
  const t = useTranslations('admin.todo')
  const [groupSlug, setGroupSlug] = useState<string | null>(null)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [todosTotal, setTodosTotal] = useState(0)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    const fetchGroup = groupSlug
      ? Promise.resolve(groupSlug)
      : fetch('/api/v1/me').then(r => r.json()).then(d => d.groups?.[0]?.slug ?? null)

    fetchGroup.then(slug => {
      if (slug) setGroupSlug(slug)
      if (!slug) { setLoading(false); return }
      return fetch(`/api/v1/${slug}/apps/todo/items?page=1&limit=50`)
        .then(r => r.json())
        .then(res => {
          setTodos(res.data ?? [])
          setTodosTotal(res.pagination?.total ?? 0)
        })
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [refresh])

  async function handleDeleteTodo(id: string) {
    const res = await fetch(`/api/v1/${groupSlug}/apps/todo/items/${id}`, { method: 'DELETE' })
    if (res.ok) setRefresh(r => r + 1)
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
          {todos.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-800">{item.title}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">{item.priority}</span>
                  <span className="text-[10px] text-slate-400">{item.status}</span>
                  {item.assigned_to && <span className="text-[10px] text-slate-400">→ assigned</span>}
                </div>
              </div>
              <button onClick={() => handleDeleteTodo(item.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
