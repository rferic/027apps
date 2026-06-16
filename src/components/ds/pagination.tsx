interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export function DsPagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        fontFamily: 'var(--font-body)', padding: '16px 0',
      }}
    >
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        style={{
          padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
          background: 'var(--color-surface)', cursor: page <= 1 ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-sm)', color: page <= 1 ? 'var(--color-border)' : 'var(--color-text)',
          opacity: page <= 1 ? 0.5 : 1,
        }}
        aria-label="Previous page"
      >
        ←
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '6px 8px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              minWidth: 36, height: 36, borderRadius: 'var(--radius-md)', border: 'none',
              background: p === page ? 'var(--color-brand)' : 'transparent',
              color: p === page ? 'white' : 'var(--color-text-secondary)',
              fontWeight: p === page ? 700 : 500,
              cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              transition: 'all var(--transition-fast)',
            }}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
          background: 'var(--color-surface)', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-sm)', color: page >= totalPages ? 'var(--color-border)' : 'var(--color-text)',
          opacity: page >= totalPages ? 0.5 : 1,
        }}
        aria-label="Next page"
      >
        →
      </button>
    </nav>
  )
}
