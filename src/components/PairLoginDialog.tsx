'use client'

import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import { useTranslations } from 'next-intl'

interface PairSession {
  session_id: string
  code: string
  qr_data: string
  expires_at: string
}

export function PairLoginDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('auth')
  const [session, setSession] = useState<PairSession | null>(null)
  const [qrSvg, setQrSvg] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const initSession = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/pair', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.message || t('pair.failedToCreate')); return }

      setSession(data)
      setCode(data.code)
      const svg = await QRCode.toString(data.qr_data, { type: 'svg', margin: 2, width: 280, color: { dark: '#0f172a', light: '#ffffff' } })
      setQrSvg(svg)
    } catch { setError(t('pair.connectionError')) }
    setLoading(false)
  }, [])

  // Rotate code every 30s (refresh at :00 and :30)
  useEffect(() => {
    if (!session) return
    const now = Date.now()
    const nextTick = 60000 - (now % 60000) + 1000
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/v1/auth/pair', { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
          setSession(data)
          setCode(data.code)
          const svg = await QRCode.toString(data.qr_data, { type: 'svg', margin: 2, width: 280 })
          setQrSvg(svg)
        }
      } catch { /* ignore */ }
    }, nextTick)
    return () => clearTimeout(timer)
  }, [session])

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { initSession() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">{t('pair.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        {loading && !session && (
          <div className="text-center py-8 text-sm text-slate-400">{t('pair.creatingSession')}</div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={initSession} className="text-sm font-medium text-red-800 hover:text-red-900">{t('pair.retry')}</button>
          </div>
        )}

        {session && (
          <div className="text-center">
            <div className="mb-4 flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="text-xs text-slate-400 mb-3">{t('pair.scanQr')}</p>

            <div className="bg-slate-50 rounded-lg px-4 py-3 mb-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t('pair.pairingCode')}</p>
              <p className="text-2xl font-bold font-mono tracking-[0.3em] text-slate-900">{code}</p>
            </div>
            <p className="text-[10px] text-slate-400">{t('pair.codeRefreshes')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
