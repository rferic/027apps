'use client'

interface Option<T extends string = string> {
  value: T
  label: string
}

interface Props<T extends string = string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  color?: string
  fullWidth?: boolean
}

export function DsSegmented<T extends string = string>({ options, value, onChange, color = '#10B981', fullWidth }: Props<T>) {
  return (
    <div style={{
      display: fullWidth ? 'flex' : 'inline-flex', alignItems: 'center', gap: 1,
      background: 'var(--color-muted)', borderRadius: 'var(--radius-lg)',
      padding: 2,
    }}>
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            style={{
              flex: fullWidth ? 1 : undefined,
              padding: '5px 12px', fontSize: 12, fontWeight: isActive ? 600 : 400,
              borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all var(--transition-fast)',
              background: isActive ? 'var(--color-bg)' : 'transparent',
              color: isActive ? color : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >{opt.label}</button>
        )
      })}
    </div>
  )
}
