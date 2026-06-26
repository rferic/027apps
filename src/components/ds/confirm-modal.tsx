'use client'

import { type ReactNode, useState } from 'react'
import { DsModal } from './modal'
import { DsButton } from './button'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'success'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  children?: ReactNode
}

export function DsConfirmModal({ open, onClose, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger', loading, onConfirm, children }: Props) {
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = loading ?? internalLoading

  const handleConfirm = async () => {
    setInternalLoading(true)
    try { await onConfirm() } catch {} finally { setInternalLoading(false) }
  }

  const confirmBg = variant === 'success' ? '#10B981' : '#EF4444'

  return (
    <DsModal open={open} onClose={onClose} title={title}>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: children ? 12 : 16 }}>
        {message}
      </p>
      {children && (
        <div style={{ background: 'var(--color-muted)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
          {children}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <DsButton variant="ghost" onClick={onClose}>{cancelLabel}</DsButton>
        <DsButton style={{ background: confirmBg, color: 'white', border: 'none' }} disabled={isLoading} onClick={handleConfirm}>
          {isLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1 inline-block" />}{confirmLabel}
        </DsButton>
      </div>
    </DsModal>
  )
}
