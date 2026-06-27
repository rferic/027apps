'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface PushToken {
  id: string
  token: string
  platform: string
  updated_at: string
}

export function PushTokensSection({ tokens, userId }: { tokens: PushToken[]; userId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleRevoke(tokenId: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/users/${userId}/push-tokens/${tokenId}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          toast.success('Push token revoked')
          router.refresh()
        } else {
          const data = await res.json()
          toast.error(data.message || 'Failed to revoke token')
        }
      } catch {
        toast.error('Failed to revoke token')
      }
    })
  }

  async function handleRevokeAll() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/users/${userId}/push-tokens`, {
          method: 'DELETE',
        })
        if (res.ok) {
          toast.success('All push tokens revoked')
          router.refresh()
        } else {
          const data = await res.json()
          toast.error(data.message || 'Failed to revoke tokens')
        }
      } catch {
        toast.error('Failed to revoke tokens')
      }
    })
  }

  if (tokens.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Push Tokens</h2>
        <p className="text-sm text-muted-foreground">No push tokens registered.</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Push Tokens ({tokens.length})</h2>
        <button
          onClick={handleRevokeAll}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Revoke all
        </button>
      </div>
      <div className="space-y-2">
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  t.platform === 'ios' ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {t.platform}
                </span>
                <span className="text-xs text-muted-foreground truncate block max-w-[200px] font-mono">
                  {t.token.slice(0, 32)}...
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Updated {new Date(t.updated_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => handleRevoke(t.id)}
              disabled={isPending}
              className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 flex-shrink-0"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
