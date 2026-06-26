'use client'

import { type InputHTMLAttributes } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label?: string
  color?: string
}

export function DsCheckbox({ label, id, color, checked, style, ...props }: Props) {
  const checkId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)
  const brandColor = color || 'var(--color-brand)'

  return (
    <label
      htmlFor={checkId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text)',
        opacity: props.disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 18,
          height: 18,
          flexShrink: 0,
        }}
      >
        <input
          id={checkId}
          type="checkbox"
          checked={checked}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            margin: 0,
            width: '100%',
            height: '100%',
          }}
          {...props}
        />
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 'var(--radius-sm)',
            border: `1.5px solid ${checked ? brandColor : 'var(--color-border)'}`,
            background: checked ? brandColor : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all var(--transition-fast)',
            pointerEvents: 'none',
          }}
        >
          {checked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          )}
        </div>
      </div>
      {label}
    </label>
  )
}
