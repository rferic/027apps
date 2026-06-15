import type { ReactNode, HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingMap = {
  sm: 16,
  md: 20,
  lg: 28,
}

export function DsCard({ children, padding = 'md', hover = true, style, ...props }: Props) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: paddingMap[padding],
        fontFamily: 'var(--font-body)',
        transition: 'all var(--transition-base)',
        ...(hover ? { cursor: 'pointer' } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
