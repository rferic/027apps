import { useState, useRef, useEffect } from 'react'
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MemberOption {
  id: string
  display_name: string | null
}

interface Props {
  members: MemberOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  idKey?: string
  excludeId?: string
}

export function MemberSelect({ members, value, onChange, placeholder = 'Selecciona...', idKey = 'id', excludeId }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selected = members.find(m => (m as any)[idKey] === value)
  const filtered = members.filter(m => (!search || m.display_name?.toLowerCase().includes(search.toLowerCase())) && (m as any)[idKey] !== excludeId)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected?.display_name ?? '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setSearch('') }}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-card text-foreground"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 max-h-44 overflow-auto">
          {filtered.map(m => (
            <div key={(m as any)[idKey]}
              onMouseDown={() => { onChange((m as any)[idKey]); setOpen(false); setSearch('') }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${(m as any)[idKey] === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-foreground'}`}
            >{m.display_name ?? 'Unknown'}</div>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>}
        </div>
      )}
    </div>
  )
}
