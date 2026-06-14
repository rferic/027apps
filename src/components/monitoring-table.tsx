import type { Metric } from '@/lib/monitoring'

function pct(used: number, limit: number): number {
  if (limit === 0) return 0
  return Math.round((used / limit) * 100)
}

function pctColor(used: number, limit: number): string {
  const v = pct(used, limit)
  if (v >= 85) return 'text-red-600'
  if (v >= 60) return 'text-amber-600'
  return 'text-emerald-600'
}

function formatVal(v: number, unit: string): string {
  if (unit === 'requests' && v >= 1000) return `${(v / 1000).toFixed(1)}k`
  if (unit === 'hours' && v >= 1) return `${v}h`
  return `${v}${unit}`
}

interface Props {
  data: { providerName: string; icon: string; metrics: Metric[] }[]
}

export function MonitoringTable({ data }: Props) {
  if (data.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <th className="text-left px-5 py-3 font-medium">Provider</th>
            <th className="text-left px-5 py-3 font-medium">Resource</th>
            <th className="text-right px-5 py-3 font-medium">Used</th>
            <th className="text-right px-5 py-3 font-medium">Limit</th>
            <th className="text-right px-5 py-3 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(group =>
            group.metrics.map((m, i) => (
              <tr key={m.key} className="border-b border-slate-50 last:border-0">
                {i === 0 && (
                  <td
                    className="px-5 py-3 text-slate-700 font-medium"
                    rowSpan={group.metrics.length}
                  >
                    {group.icon} {group.providerName}
                  </td>
                )}
                <td className="px-5 py-3 text-slate-600">{m.label}</td>
                <td className="px-5 py-3 text-right text-slate-800 font-medium tabular-nums">
                  {formatVal(m.used, m.unit)}
                </td>
                <td className="px-5 py-3 text-right text-slate-400 tabular-nums">
                  {formatVal(m.limit, m.unit)}
                </td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${pctColor(m.used, m.limit)}`}>
                  {pct(m.used, m.limit)}%
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
