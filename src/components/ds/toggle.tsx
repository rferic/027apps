'use client'

import { useState } from 'react'

interface Props {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  color?: string
}

export function DsToggle({ checked: controlled, onChange, label, disabled, color }: Props) {
  const [internal, setInternal] = useState(false)
  const isChecked = controlled !== undefined ? controlled : internal

  const toggle = () => {
    if (disabled) return
    const next = !isChecked
    if (controlled === undefined) setInternal(next)
    onChange?.(next)
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      role="switch"
      aria-checked={isChecked}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 9999,
          background: isChecked ? (color || 'var(--color-brand)') : 'var(--color-border)',
          position: 'relative',
          transition: 'background var(--transition-fast)',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'white',
            position: 'absolute',
            top: 2,
            left: isChecked ? 22 : 2,
            transition: 'left var(--transition-fast)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}
        />
      </div>
      {label && <span>{label}</span>}
    </button>
  )
}
