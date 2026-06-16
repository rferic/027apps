import type { ReactNode } from 'react'

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'outline'

interface Props {
  children: ReactNode
  variant?: Variant
  style?: React.CSSProperties
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--color-brand-soft)', color: 'var(--color-brand)' },
  success: { background: 'var(--color-success-soft)', color: 'var(--color-success)' },
  warning: { background: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
  error: { background: 'var(--color-error-soft)', color: 'var(--color-error)' },
  neutral: { background: 'var(--color-muted)', color: 'var(--color-text-secondary)' },
  outline: { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
}

export function DsBadge({ children, variant = 'neutral', style }: Props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        padding: '2px 10px',
        borderRadius: 'var(--radius-md)',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
