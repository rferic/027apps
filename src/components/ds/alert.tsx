import { type ReactNode } from 'react'

type Variant = 'success' | 'warning' | 'error' | 'info'

interface Props {
  children: ReactNode
  variant?: Variant
  icon?: string
  onDismiss?: () => void
}

const variantStyles: Record<Variant, { bg: string; color: string; border: string; defaultIcon: string }> = {
  success: { bg: 'var(--color-success-soft)', color: 'var(--color-success)', border: 'var(--color-success)', defaultIcon: '✅' },
  warning: { bg: 'var(--color-warning-soft)', color: 'var(--color-warning)', border: 'var(--color-warning)', defaultIcon: '⚠️' },
  error: { bg: 'var(--color-error-soft)', color: 'var(--color-error)', border: 'var(--color-error)', defaultIcon: '❌' },
  info: { bg: 'var(--color-brand-soft)', color: 'var(--color-brand)', border: 'var(--color-brand)', defaultIcon: 'ℹ️' },
}

export function DsAlert({ children, variant = 'info', icon, onDismiss }: Props) {
  const s = variantStyles[variant]
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-size-sm)',
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon || s.defaultIcon}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, fontSize: 14, padding: 0, flexShrink: 0 }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  )
}
