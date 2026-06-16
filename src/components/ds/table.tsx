import type { ReactNode } from 'react'

interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
}

export function DsTable<T extends Record<string, unknown>>({ columns, data, onRowClick }: Props<T>) {
  return (
    <div style={{
      overflowX: 'auto',
      fontFamily: 'var(--font-body)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-xl)',
      background: 'var(--color-surface)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-muted)' }}>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  textAlign: col.align || 'left',
                  padding: '10px 16px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-secondary)' }}>
                No data
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr
                key={ri}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: ri < data.length - 1 ? '1px solid var(--color-border)' : 'none',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = 'var(--color-muted)' }}
                onMouseLeave={(e) => { if (onRowClick) e.currentTarget.style.background = 'transparent' }}
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    style={{
                      textAlign: col.align || 'left',
                      padding: '12px 16px',
                      color: 'var(--color-text)',
                    }}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
