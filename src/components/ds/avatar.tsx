import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  size?: number
  color?: string
  className?: string
}

export function DsAvatar({ children, size = 32, color, className }: Props) {
  const bg = color || 'var(--color-brand)'
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-md)',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
    </div>
  )
}
