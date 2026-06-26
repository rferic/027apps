'use client'

import { useState, useTransition } from 'react'
import { useTranslations, useFormatter } from 'next-intl'
import type { ApiKey } from '@/lib/use-cases/api-keys/types'
import { createApiKeyAction, revokeApiKeyAction } from './actions'

interface Props {
  initialKeys: ApiKey[]
}

export function ApiKeysManager({ initialKeys }: Props) {
  const t = useTranslations('admin.settings.api_keys')
  const format = useFormatter()
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null)

  // Create modal state
  const [keyName, setKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<{ rawKey: string; id: string } | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isCreating, startCreateTransition] = useTransition()

  // Revoke state
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [isRevoking, startRevokeTransition] = useTransition()

  function openCreateModal() {
    setKeyName('')
    setCreatedKey(null)
    setCreateError(null)
    setCopied(false)
    setShowCreateModal(true)
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setCreatedKey(null)
    setKeyName('')
    setCreateError(null)
  }

  function handleCreate() {
    if (!keyName.trim()) return
    setCreateError(null)
    startCreateTransition(async () => {
      const result = await createApiKeyAction(keyName.trim())
      if ('error' in result) {
        setCreateError(result.error)
      } else {
        setCreatedKey(result)
        // Refresh key list — server revalidated, but we update local state optimistically
        // We don't have the full key object, so we'll let the user close and reload
      }
    })
  }

  function handleCopy() {
    if (!createdKey) return
    navigator.clipboard.writeText(createdKey.rawKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDone() {
    closeCreateModal()
    // Reload the page to refresh the key list (server revalidated)
    window.location.reload()
  }

  function openRevokeConfirm(id: string) {
    setRevokeError(null)
    setRevokeTargetId(id)
  }

  function closeRevokeModal() {
    setRevokeTargetId(null)
    setRevokeError(null)
  }

  function handleRevoke() {
    if (!revokeTargetId) return
    startRevokeTransition(async () => {
      const result = await revokeApiKeyAction(revokeTargetId)
      if (result.error) {
        setRevokeError(result.error)
      } else {
        setKeys((prev) => prev.filter((k) => k.id !== revokeTargetId))
        closeRevokeModal()
      }
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="cursor-pointer px-3.5 py-2 text-sm font-medium bg-foreground hover:bg-foreground text-white rounded-lg transition-colors"
        >
          {t('new_key')}
        </button>
      </div>

      {/* Keys list */}
      <div className="bg-card rounded-xl border border-border">
        {keys.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">{t('no_keys')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('key_name_label')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('prefix_label')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  Scope
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  {t('created_at_label')}
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  {t('last_used_label')}
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{key.name}</td>
                  <td className="px-5 py-3 font-mono text-muted-foreground text-xs">{key.keyPrefix}…</td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                      {key.scope === 'group' ? t('scope_group') : t('scope_user')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                    {key.createdAt ? format.dateTime(new Date(key.createdAt), { year: 'numeric', month: 'short', day: 'numeric' }) : t('never')}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell">
                    {key.lastUsedAt ? format.dateTime(new Date(key.lastUsedAt), { year: 'numeric', month: 'short', day: 'numeric' }) : t('never')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openRevokeConfirm(key.id)}
                      className="cursor-pointer px-3 py-1 text-xs font-medium border border-red-200 bg-red-50 text-red-700 rounded-full hover:bg-red-100 transition-colors"
                    >
                      {t('revoke_button')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={closeCreateModal}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-md mx-4">
            {createdKey ? (
              <>
                <h3 className="text-base font-semibold text-foreground mb-1">{t('created_title')}</h3>
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {t('created_warning')}
                </p>
                <div className="flex gap-2 mb-5">
                  <input
                    type="text"
                    readOnly
                    value={createdKey.rawKey}
                    className="flex-1 font-mono text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="cursor-pointer px-3 py-2 text-sm font-medium bg-foreground hover:bg-foreground text-white rounded-lg transition-colors whitespace-nowrap"
                  >
                    {copied ? '✓' : t('copy_button')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDone}
                  className="cursor-pointer w-full py-2 text-sm font-medium bg-foreground hover:bg-foreground text-white rounded-lg transition-colors"
                >
                  {t('done_button')}
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-foreground mb-4">{t('create_modal_title')}</h3>
                <label className="block mb-1 text-sm font-medium text-foreground">
                  {t('key_name_label')}
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t('key_name_placeholder')}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                  autoFocus
                />
                {createError && (
                  <p className="text-sm text-red-600 mb-3">{createError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
                  >
                    {t('cancel_button')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating || !keyName.trim()}
                    className="cursor-pointer px-4 py-2 text-sm font-medium bg-foreground hover:bg-foreground disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {isCreating ? '…' : t('create_button')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke confirm modal */}
      {revokeTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={closeRevokeModal}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">{t('revoke_confirm_title')}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t('revoke_confirm_message')}</p>
            {revokeError && (
              <p className="text-sm text-red-600 mb-3">{revokeError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeRevokeModal}
                className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
              >
                {t('cancel_button')}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isRevoking}
                className="cursor-pointer px-4 py-2 text-sm font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
              >
                {isRevoking ? '…' : t('revoke_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
