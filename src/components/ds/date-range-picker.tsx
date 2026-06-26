'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

export function DateRangePicker({ from, to, onFromChange, onToChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [selecting, setSelecting] = useState<'from' | 'to'>('from')
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !popupRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)

  function isInRange(day: number): boolean {
    if (!from || !to) return false
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return d >= from && d <= to
  }

  function isSelected(day: number): boolean {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return d === from || d === to
  }

  function isFuture(day: number): boolean {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return d > today
  }

  function handleDayClick(day: number) {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (isFuture(day)) return
    if (selecting === 'from') {
      onFromChange(d)
      onToChange('')
      setSelecting('to')
    } else {
      if (d < from) {
        onToChange(from)
        onFromChange(d)
      } else {
        onToChange(d)
      }
      setSelecting('from')
      setOpen(false)
    }
  }

  const formatDisplay = () => {
    if (from && to) return `${new Date(from + 'T00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} → ${new Date(to + 'T00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}`
    if (from) return `${new Date(from + 'T00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })} → ...`
    return 'Seleccionar fechas'
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect()
          if (rect) {
            const spaceBelow = window.innerHeight - rect.bottom
            const top = spaceBelow > 320 ? rect.bottom + 4 : rect.top - 324
            setPopupPos({ top, left: rect.left })
          }
          setOpen(!open); setSelecting('from'); setViewDate(from ? new Date(from + 'T00:00') : new Date())
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '8px 12px', fontSize: 13,
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)', color: (from ? 'var(--color-text)' : 'var(--color-text-secondary)'),
          cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)',
          gap: 8,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatDisplay()}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {(from || to) && (
          <span onClick={e => { e.stopPropagation(); onFromChange(''); onToChange('') }}
            style={{ flexShrink: 0, color: 'var(--color-text-secondary)', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}>×</span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={popupRef} style={{
          position: 'fixed', top: popupPos.top, left: popupPos.left,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          zIndex: 9999, padding: 12, minWidth: 260,
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-secondary)' }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-secondary)' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {DAYS.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary)', padding: 4 }}>{d}</div>)}
            {days.map((day, i) => (
              <button
                key={i}
                type="button"
                disabled={day === null || isFuture(day!)}
                onClick={() => day && handleDayClick(day)}
                style={{
                  padding: 6, fontSize: 12, border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: day && !isFuture(day) ? 'pointer' : 'default',
                  background: isSelected(day!) ? '#10B981' : isInRange(day!) ? '#D1FAE5' : 'transparent',
                  color: isSelected(day!) ? 'white' : isFuture(day!) ? 'var(--color-text-secondary)' : 'var(--color-text)',
                  fontWeight: isSelected(day!) ? 600 : 400,
                  opacity: day === null || isFuture(day!) ? 0.3 : 1,
                }}
              >{day ?? ''}</button>
            ))}
          </div>

          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" onClick={() => { onFromChange(''); onToChange(''); setOpen(false) }}
              style={{ flex: 1, padding: '6px 0', fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              Limpiar
            </button>
            <button type="button" onClick={() => setOpen(false)}
              style={{ flex: 1, padding: '6px 0', fontSize: 12, border: 'none', borderRadius: 'var(--radius-md)', background: '#10B981', color: 'white', cursor: 'pointer' }}>
              OK
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
