import { useState, type ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface Props {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (id: string) => void
}

export function DsTabs({ tabs, defaultTab, onChange }: Props) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id)

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActive(tab.id); onChange?.(tab.id) }}
            style={{
              padding: '10px 20px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: active === tab.id ? 700 : 500,
              color: active === tab.id ? 'var(--color-brand)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: active === tab.id ? '2px solid var(--color-brand)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'all var(--transition-fast)',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.id === active)?.content}
    </div>
  )
}
