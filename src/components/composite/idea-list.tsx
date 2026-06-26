import { DsCard } from '@/components/ds/card'
import { DsBadge } from '@/components/ds/badge'

export interface IdeaItemData {
  id: string
  title: string
  type: string
  votes: number
  comments: number
}

interface Props {
  items: IdeaItemData[]
  title?: string
  onViewAll?: () => void
}

export function IdeaList({ items, title = 'Inspiración', onViewAll }: Props) {
  return (
    <DsCard padding="md" hover={false}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
          {title}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '1px 10px', borderRadius: 'var(--radius-md)',
          background: 'var(--color-brand-soft)', color: 'var(--color-brand)',
        }}>
          {items.reduce((s, i) => s + i.votes, 0)} votos
        </span>
      </div>

      {items.map((idea, i) => (
        <div
          key={idea.id}
          style={{
            display: 'flex', gap: 10, padding: '10px 0',
            borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
          }}
        >
          <DsBadge variant="neutral">
            {idea.type === 'new_app' ? 'Nueva app' : 'Mejora'}
          </DsBadge>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
              {idea.title}
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              ♥ {idea.votes} · 💬 {idea.comments}
            </p>
          </div>
        </div>
      ))}

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
