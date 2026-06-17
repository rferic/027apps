import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  color?: string
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-brand)',
    color: 'white',
    border: 'none',
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-brand)',
    border: '1px solid var(--color-brand)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: 'none',
  },
}

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: 'var(--font-size-xs)' },
  md: { padding: '10px 20px', fontSize: 'var(--font-size-sm)' },
  lg: { padding: '14px 28px', fontSize: 'var(--font-size-base)' },
}

export function DsButton({ variant = 'primary', size = 'md', color, style, children, ...props }: Props) {
  const overrides: React.CSSProperties = {}
  if (color) {
    if (variant === 'primary' || variant === 'secondary') overrides.background = color
    if (variant === 'outline' || variant === 'ghost') overrides.color = color
    if (variant === 'outline') overrides.borderColor = color
  }
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-weight-semibold)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        lineHeight: 1,
        ...variantStyles[variant],
        ...overrides,
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}
