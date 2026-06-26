import { useCallback } from 'react'
import { DsBadge } from '@/components/ds/badge'
import { DsAvatar } from '@/components/ds/avatar'
import type { CSSProperties } from 'react'

export interface TodoItemData {
  id: string
  title: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  category: string
  emoji: string
  due: string
  assignee: string
  done: boolean
}

interface Props {
  item: TodoItemData
  onToggle?: (id: string) => void
  onClick?: (id: string) => void
  style?: CSSProperties
}

const priorityColors: Record<string, string> = {
  urgent: 'var(--color-priority-urgent)',
  high: 'var(--color-priority-high)',
  medium: 'var(--color-priority-medium)',
  low: 'var(--color-priority-low)',
}

function handleCheckKey(e: React.KeyboardEvent, cb?: (id: string) => void, id?: string) {
  if ((e.key === 'Enter' || e.key === ' ') && cb && id) {
    e.preventDefault()
    cb(id)
  }
}

export function TodoItem({ item, onToggle, onClick, style }: Props) {
  const toggleId = useCallback(() => onToggle?.(item.id), [onToggle, item.id])

  return (
    <div
      onClick={() => onClick?.(item.id)}
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 0',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        opacity: item.done ? 0.5 : 1,
        transition: 'opacity 0.15s',
        borderBottom: '1px solid var(--color-border)',
        ...style,
      }}
    >
      <div
        role="checkbox"
        aria-checked={item.done}
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); toggleId() }}
        onKeyDown={(e) => handleCheckKey(e, onToggle, item.id)}
        style={{
          width: 20, height: 20, borderRadius: 'var(--radius-md)',
          border: `2px solid ${item.done ? 'var(--color-success)' : 'var(--color-border)'}`,
          background: item.done ? 'var(--color-success)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12"/></svg>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0, textDecoration: item.done ? 'line-through' : 'none' }}>
          {item.title}
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <DsBadge variant="neutral" style={{ color: priorityColors[item.priority], background: `${priorityColors[item.priority]}15` }}>
            {item.priority}
          </DsBadge>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {item.emoji} {item.category}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: item.due === 'Hoy' ? 'var(--color-brand)' : 'var(--color-text-secondary)',
          }}>
            {item.due === 'Hoy' ? '⚠ Hoy' : item.due}
          </span>
        </div>
      </div>

      {item.assignee && (
        <DsAvatar size={24} color="var(--color-surface-secondary)">
          {item.assignee[0]}
        </DsAvatar>
      )}
    </div>
  )
}
