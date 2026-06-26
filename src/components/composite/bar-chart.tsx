interface BarDatum {
  label: string
  value: number
}

interface Props {
  data: BarDatum[]
  highlightIndex?: number
  color?: string
  height?: number
  showLine?: boolean
  lineColor?: string
}

export function BarChart({ data, highlightIndex, color = 'var(--color-brand)', height = 100, showLine, lineColor }: Props) {
  const max = Math.max(...data.map(d => d.value), 1)
  const count = data.length
  const step = Math.max(40, count > 10 ? 30 : 40)
  const barWidth = Math.min(24, (step * count - 8) / count)
  const chartHeight = height - 28
  const lColor = lineColor || color

  const points = showLine ? data.map((d, i) => {
    const x = 10 + i * step + barWidth / 2
    const barH = (d.value / max) * chartHeight
    return `${x},${height - 18 - barH}`
  }).join(' ') : ''

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${Math.max(300, count * step)} ${height}`} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * chartHeight
        const isHighlight = !showLine && highlightIndex === i
        const barFill = showLine ? color : (isHighlight ? color : 'var(--color-border)')
        return (
          <g key={i}>
            <rect
              x={10 + i * step}
              y={height - 18 - barH}
              width={barWidth}
              height={barH}
              rx={4}
              fill={barFill}
              opacity={showLine ? 0.7 : (isHighlight ? 1 : 0.4)}
            />
            <text
              x={10 + i * step + barWidth / 2}
              y={height - 3}
              textAnchor="middle"
              fontSize="8"
              fill="var(--color-text-secondary)"
            >
              {d.label}
            </text>
            <text
              x={10 + i * step + barWidth / 2}
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
      {showLine && points && (
        <>
          <polyline points={points} fill="none" stroke={lColor} strokeWidth={2} />
          {data.map((d, i) => {
            const x = 10 + i * step + barWidth / 2
            const barH = (d.value / max) * chartHeight
            return <circle key={i} cx={x} cy={height - 18 - barH} r={3} fill={lColor} />
          })}
        </>
      )}
    </svg>
  )
}
