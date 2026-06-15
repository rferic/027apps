import type { ReactNode } from 'react'

interface Props {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

export function DsEmptyState({ icon = '📭', title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: 'var(--font-body)',
      }}
    >
      <span style={{ fontSize: 48, marginBottom: 16 }}>{icon}</span>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 16px', maxWidth: 300 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
