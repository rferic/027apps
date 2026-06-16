import { DsCard } from '@/components/ds/card'
import { DsButton } from '@/components/ds/button'
import { TodoItem, type TodoItemData } from './todo-item'

interface Props {
  items: TodoItemData[]
  title?: string
  onNew?: () => void
  onToggle?: (id: string) => void
  onClick?: (id: string) => void
  onViewAll?: () => void
}

export function TodoList({ items, title = 'Todo', onNew, onToggle, onClick, onViewAll }: Props) {
  return (
    <DsCard padding="md" hover={false}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            {title}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '1px 10px', borderRadius: 'var(--radius-md)',
            background: 'var(--color-muted)', color: 'var(--color-text-secondary)',
          }}>
            Hoy
          </span>
        </div>
        {onNew && (
          <DsButton size="sm" onClick={onNew}>+ Nueva</DsButton>
        )}
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0', margin: 0 }}>
          No hay tareas pendientes
        </p>
      ) : (
        items.map((item) => (
          <TodoItem key={item.id} item={item} onToggle={onToggle} onClick={onClick} />
        ))
      )}

      {onViewAll && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span
            onClick={onViewAll}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', cursor: 'pointer' }}
          >
            Ver todas →
          </span>
        </div>
      )}
    </DsCard>
  )
}
