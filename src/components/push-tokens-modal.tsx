'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface PushToken {
  id: string
  token: string
  platform: string
  updated_at: string
}

interface Props {
  userId: string
  userName: string
  onClose: () => void
}

export function PushTokensModal({ userId, userName, onClose }: Props) {
  const router = useRouter()
  const [tokens, setTokens] = useState<PushToken[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/push-tokens`)
      const data = await res.json()
      setTokens(data.tokens ?? [])
    } catch {
      toast.error('Failed to load push tokens')
      setTokens([])
    }
    setLoading(false)
  }, [userId])

  const handleRevoke = async (tokenId: string) => {
    setRevoking(tokenId)
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/push-tokens/${tokenId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Push token revoked. User session invalidated.')
        setTokens((prev) => prev?.filter((t) => t.id !== tokenId) ?? null)
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to revoke')
      }
    } catch {
      toast.error('Failed to revoke')
    }
    setRevoking(null)
  }

  const handleRevokeAll = async () => {
    setRevoking('all')
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/push-tokens`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('All push tokens revoked. User session invalidated.')
        setTokens([])
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to revoke')
      }
    } catch {
      toast.error('Failed to revoke')
    }
    setRevoking(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Push Tokens</h2>
            <p className="text-sm text-slate-400">{userName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        {!tokens && !loading && (
          <div className="text-center py-6">
            <button
              onClick={load}
              className="text-sm font-medium text-red-800 hover:text-red-900"
            >
              Load push tokens
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-6 text-sm text-slate-400">Loading...</div>
        )}

        {tokens && tokens.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 mb-3">No push tokens registered.</p>
            {tokens !== null && (
              <span className="text-xs text-slate-300">User will stay logged in until their session naturally expires or is blocked.</span>
            )}
          </div>
        )}

        {tokens && tokens.length > 0 && (
          <>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                        t.platform === 'ios' ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {t.platform}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                        {t.token.slice(0, 28)}...
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Updated {new Date(t.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(t.id)}
                    disabled={revoking === t.id}
                    className="text-[11px] font-medium text-red-500 hover:text-red-700 disabled:opacity-50 flex-shrink-0"
                  >
                    {revoking === t.id ? '...' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleRevokeAll}
              disabled={revoking === 'all'}
              className="w-full text-center text-xs font-medium text-red-600 hover:text-red-700 py-2 border-t border-slate-100 disabled:opacity-50"
            >
              {revoking === 'all' ? 'Revoking...' : 'Revoke all tokens'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
