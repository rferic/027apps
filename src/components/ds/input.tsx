import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface BaseProps {
  label?: string
  error?: string
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseProps {}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseProps {}

export function DsInput({ label, error, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
          {label}
        </label>
      )}
      <input
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text)',
          background: 'var(--color-muted)',
          border: `1.5px solid ${error ? 'var(--color-priority-urgent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '11px 14px',
          width: '100%',
          outline: 'none',
          transition: 'all var(--transition-fast)',
          ...style,
        }}
        {...props}
      />
      {error && (
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-priority-urgent)', margin: 0 }}>{error}</p>
      )}
    </div>
  )
}

export function DsTextarea({ label, error, style, ...props }: TextareaProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
          {label}
        </label>
      )}
      <textarea
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text)',
          background: 'var(--color-muted)',
          border: `1.5px solid ${error ? 'var(--color-priority-urgent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '11px 14px',
          width: '100%',
          outline: 'none',
          resize: 'vertical',
          transition: 'all var(--transition-fast)',
          ...style,
        }}
        {...props}
      />
    </div>
  )
}
