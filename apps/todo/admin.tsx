'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DsCheckbox } from '@/components/ds/checkbox'
import { Loader2, X, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { TodoItemCard, type TodoItem, type Category } from './TodoItemCard'
import EditTodoModal from './EditTodoModal'

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
  const [detailItem, setDetailItem] = useState<TodoItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<TodoItem | null>(null)
  const [deleteSeries, setDeleteSeries] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const catMap = new Map(categories.map(c => [c.id, c]))

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
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer">
          <option value="">{tApp('filter_category')}</option>
          {categories.map(c => (<option key={c.id} value={c.id}>{c.emoji} {c.name}</option>))}
        </select>
        <select value={filters.priority} onChange={e => setFilters(f => ({...f, priority: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer">
          <option value="">{tApp('filter_priority')}</option>
          {Object.keys(PRIORITY_CONFIG).map(k => (<option key={k} value={k}>{tApp('priority_' + k)}</option>))}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer">
          <option value="">{tApp('filter_status')}</option>
          <option value="pending">{tApp('status_pending')}</option>
          <option value="done">{tApp('status_done')}</option>
        </select>
        <select value={filters.visibility} onChange={e => setFilters(f => ({...f, visibility: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer">
          <option value="">{tApp('visibility_label')}</option>
          <option value="public">{tApp('visibility_public')}</option>
          <option value="private">{tApp('visibility_private')}</option>
        </select>
        <select value={filters.assigned} onChange={e => setFilters(f => ({...f, assigned: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer">
          <option value="">{tApp('filter_assigned')}</option>
          <option value="null">{tApp('unassigned')}</option>
          {[...new Set(todos.filter(t => t.assigned_to).map(t => t.assigned_to!))].map(id => (
            <option key={id} value={id}>{memberMap.get(id) || id.slice(0, 8)}</option>
          ))}
        </select>
        {groups.length > 0 && (
        <select value={filters.group} onChange={e => setFilters(f => ({...f, group: e.target.value}))}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer">
          <option value="">{t('filter_group')}</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        )}
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-border bg-card text-muted-foreground cursor-pointer ml-auto">
          <option value="updated">{tApp('sort_updated')}</option>
          <option value="priority">{tApp('sort_priority')}</option>
          <option value="alpha">{tApp('sort_alpha')}</option>
          <option value="oldest">{tApp('sort_oldest')}</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">{t('no_categories')}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <TodoItemCard
              key={item.id}
              item={item}
              categories={categories}
              memberMap={memberMap}
              onStatusChange={async (todo) => {
                await fetch(`/api/v1/admin/apps/todo`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: todo.id, status: todo.status === 'done' ? 'pending' : 'done' }),
                })
                setRefresh(r => r + 1)
              }}
              onEdit={(item) => setEditItem(item)}
              onDelete={(todo) => handleDeleteTodo(todo.id)}
              onDetail={(item) => setDetailItem(item)}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <EditTodoModal
          item={editItem}
          categories={categories}
          showStatus
          assigneeMode="input"
          onSave={async (data) => {
            const res = await fetch(`/api/v1/admin/apps/todo`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: editItem.id, ...data }),
            })
            if (!res.ok) {
              const err = await res.text().catch(() => 'Failed to update')
              throw new Error(err)
            }
            setEditItem(null)
            setRefresh(r => r + 1)
          }}
          onClose={() => setEditItem(null)}
        />
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDetailItem(null)} />
          <div className="relative z-10 bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-foreground pr-4">{detailItem.title}</h3>
              <button onClick={() => setDetailItem(null)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted -mt-1 -mr-1"><X size={16} /></button>
            </div>
            {detailItem.description && <p className="text-sm text-foreground mb-3">{detailItem.description}</p>}
            <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
              {(() => {
                const dc = detailItem.category_id ? catMap.get(detailItem.category_id) : null
                return dc ? <p><span className="font-medium">{dc.emoji}</span> <span style={{ color: dc.color }}>{dc.name}</span></p> : null
              })()}
              <p><span className="font-medium text-foreground">{t('priority')}:</span> <span className="font-semibold px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: PRIORITY_CONFIG[detailItem.priority]?.color + '20' || '#6B728020', color: PRIORITY_CONFIG[detailItem.priority]?.color || '#6B7280' }}>{tApp('priority_' + detailItem.priority)}</span></p>
              <p><span className="font-medium text-foreground">{tApp('filter_status')}:</span> {tApp('status_' + detailItem.status)}</p>
              {detailItem.due_date && <p><span className="font-medium text-foreground">{tApp('due_date')}:</span> {detailItem.due_date.slice(0, 10)}</p>}
              {!detailItem.due_date && <p className="italic">{tApp('no_date')}</p>}
              {detailItem.assigned_to && <p><span className="font-medium text-foreground">{tApp('assign_to')}:</span> {memberMap.get(detailItem.assigned_to) ?? detailItem.assigned_to.slice(0, 8)}</p>}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button onClick={() => { setDetailItem(null); setEditItem(detailItem) }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={tApp('edit')}>
                <Pencil size={16} />
              </button>
              <button onClick={() => { setDetailItem(null); setDeleteItem(detailItem) }} className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors" title={tApp('delete')}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteItem(null)} />
          <div className="relative z-10 bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">{tApp('delete')}</h3>
            <p className="text-sm text-muted-foreground mb-1">{tApp('delete_confirm')}</p>
            <p className="text-sm text-foreground mb-4 font-medium">&ldquo;{deleteItem.title}&rdquo;</p>
            {deleteItem.repeat_interval && (
            <div className="mb-4">
              <DsCheckbox label={tApp('delete_series')} checked={deleteSeries} onChange={e => setDeleteSeries(e.target.checked)} />
            </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteItem(null); setDeleteSeries(false) }} className="px-3 py-1.5 text-sm text-foreground hover:text-foreground">{tApp('cancel')}</button>
              <button onClick={async () => {
                setDeleting(true)
                const params = deleteSeries ? '&delete_series=true' : ''
                const res = await fetch(`/api/v1/admin/apps/todo?id=${deleteItem.id}${params}`, { method: 'DELETE' })
                setDeleting(false)
                setDeleteItem(null)
                setDeleteSeries(false)
                if (res.ok) setRefresh(r => r + 1)
                else toast.error('Failed to delete')
              }} disabled={deleting} className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? '...' : tApp('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
