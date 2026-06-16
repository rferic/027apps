import { DsCard } from '@/components/ds/card'

interface Props {
  label: string
  value: string
  color?: string
  icon?: string
}

export function StatCard({ label, value, color, icon }: Props) {
  return (
    <DsCard padding="sm" hover={false} style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>
            {label}
          </p>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: color || 'var(--color-text)', margin: 0 }}>
            {value}
          </p>
        </div>
      </div>
    </DsCard>
  )
}
