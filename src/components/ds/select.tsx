'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
}

export function DsSelect({ options, value, onChange, placeholder = 'Seleccionar...', label }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: 'var(--font-body)' }}>
      {label && (
        <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text)', margin: '0 0 6px' }}>{label}</p>
      )}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', padding: '10px 14px', fontSize: 'var(--font-size-sm)',
          background: 'var(--color-muted)', border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', color: selected ? 'var(--color-text)' : 'var(--color-text-secondary)',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'border-color var(--transition-fast)',
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          zIndex: 50, padding: 4, maxHeight: 200, overflow: 'auto',
        }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange?.(opt.value); setOpen(false) }}
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                background: opt.value === value ? 'var(--color-muted)' : 'transparent',
                color: 'var(--color-text)',
                fontWeight: opt.value === value ? 600 : 400,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
