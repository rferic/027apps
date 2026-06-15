interface BarDatum {
  label: string
  value: number
}

interface Props {
  data: BarDatum[]
  highlightIndex?: number
  color?: string
  height?: number
}

export function BarChart({ data, highlightIndex, color = 'var(--color-brand)', height = 100 }: Props) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barWidth = Math.min(24, (300 / data.length) - 8)

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${Math.max(300, data.length * 40)} ${height}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 28)
        const isHighlight = highlightIndex === i
        return (
          <g key={i}>
            <rect
              x={10 + i * 40}
              y={height - 18 - barH}
              width={barWidth}
              height={barH}
              rx={4}
              fill={isHighlight ? color : 'var(--color-border)'}
              opacity={isHighlight ? 1 : 0.4}
            />
            <text
              x={10 + i * 40 + barWidth / 2}
              y={height - 3}
              textAnchor="middle"
              fontSize="8"
              fill="var(--color-text-secondary)"
            >
              {d.label}
            </text>
            <text
              x={10 + i * 40 + barWidth / 2}
              y={height - 18 - barH - 4}
              textAnchor="middle"
              fontSize="8"
              fill={isHighlight ? color : 'var(--color-text-secondary)'}
              fontWeight={isHighlight ? 700 : 400}
            >
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
