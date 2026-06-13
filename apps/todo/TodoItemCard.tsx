'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Check, Repeat, Pencil, UserPlus, Trash2 } from 'lucide-react'

export interface TodoItem {
  id: string; title: string; description: string | null; priority: string;
  status: string; due_date: string | null; assigned_to: string | null;
  category_id: string | null; repeat_interval: string | null;
  visibility: string; created_by: string; created_at: string;
  group_id: string; updated_at: string; repeat_end_date: string | null;
}

export interface Category {
  id: string; name: string; emoji: string; color: string; is_default?: boolean;
}

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  urgent: { color: '#EF4444' },
  high: { color: '#F97316' },
  medium: { color: '#F59E0B' },
  low: { color: '#6B7280' },
}

function formatDate(d: string | null, todayLabel: string, locale: string): string {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (date < now && date.toDateString() !== now.toDateString()) return '⚠ ' + date.toLocaleDateString(locale, opts)
  if (date.toDateString() === now.toDateString()) return todayLabel
  return date.toLocaleDateString(locale, opts)
}

interface Props {
  item: TodoItem
  categories: Category[]
  memberMap: Map<string, string>
  userId?: string | null
  showAssign?: boolean
  onStatusChange: (item: TodoItem, newStatus: string) => void | Promise<void>
  onEdit: (item: TodoItem) => void | Promise<void>
  onDelete: (item: TodoItem) => void | Promise<void>
  onDetail: (item: TodoItem) => void | Promise<void>
  onAssign?: (item: TodoItem) => void | Promise<void>
  compact?: boolean
}

export function TodoItemCard({ item, categories, memberMap, userId, showAssign, onStatusChange, onEdit, onDelete, onDetail, onAssign, compact }: Props) {
  const t = useTranslations('apps.todo')
  const locale = useLocale()
  const pc = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.low
  const isOverdue = item.due_date && new Date(item.due_date) < new Date()
  const cat = item.category_id ? categories.find(c => c.id === item.category_id) ?? null : null
  const isDone = item.status === 'done'

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 mb-3 ${isDone ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}>
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => onStatusChange(item, isDone ? 'pending' : 'done')}
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
            isDone ? 'border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'
          }`}
          style={isDone ? { backgroundColor: '#10B981' } : {}}
        >
          {isDone && <Check size={14} strokeWidth={3} color="white" />}
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onDetail(item)}>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item.title}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: pc.color + '20', color: pc.color }}>{t('priority_' + item.priority)}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {cat && (
              <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: cat.color + '20', color: cat.color }}>{cat.emoji} {cat.name}</span>
            )}
            {item.due_date ? (
              <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{formatDate(item.due_date, t('today'), locale)}</span>
            ) : (
              <span className="text-[10px] text-slate-300 italic">{t('no_date')}</span>
            )}
            {item.repeat_interval && <Repeat size={11} className="text-slate-300" />}
            {item.assigned_to && (
              <span className="text-[10px] text-slate-400">👤 {memberMap.get(item.assigned_to) ?? '...'}</span>
            )}
          </div>
        </div>
        {compact && (
        <>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={t('edit')}
          >
            <Pencil size={14} />
          </button>
          {showAssign && !item.assigned_to && userId && onAssign && (
            <button
              onClick={() => onAssign(item)}
              className="p-1.5 rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
              title={t('assign_to_me')}
            >
              <UserPlus size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => onDelete(item)}
          className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title={t('delete')}
        >
          <Trash2 size={14} />
        </button>
        </>
        )}
      </div>
    </div>
  )
}
