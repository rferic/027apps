interface Props {
  width?: string
  height?: number
  circle?: boolean
  count?: number
}

export function DsSkeleton({ width = '100%', height = 16, circle = false, count = 1 }: Props) {
  const items = Array.from({ length: count })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((_, i) => (
        <div
          key={i}
          style={{
            width: i === count - 1 && count > 1 ? '60%' : width,
            height,
            borderRadius: circle ? '50%' : 'var(--radius-md)',
            background: 'var(--color-muted)',
            animation: 'ds-shimmer 1.5s infinite',
            ...(circle ? { width: height, aspectRatio: '1' } : {}),
          }}
        />
      ))}
      <style>{`
        @keyframes ds-shimmer {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
