'use client'

import { useTransition, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createInvitationAction, sendInvitationEmailAction } from './actions'

interface Props {
  baseUrl: string
  onClose: () => void
  onCreated: () => void
  availableGroups: { id: string; name: string; slug: string }[]
}

export function CreateInvitationModal({ baseUrl, onClose, onCreated, availableGroups }: Props) {
  const [pending, startTransition] = useTransition()
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    availableGroups.length === 1 ? [availableGroups[0].id] : []
  )
  const [sendOption, setSendOption] = useState<'create' | 'create_and_send'>('create')
  const [showDropdown, setShowDropdown] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const hasEmail = emailValue.trim().length > 0
  const t = useTranslations('admin.invitations.form')
  const tI = useTranslations('admin.invitations')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createInvitationAction(formData)
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      const token = result.token
      const email = formData.get('email') as string

      if (sendOption === 'create_and_send' && email) {
        const sendResult = await sendInvitationEmailAction(token, email)
        if (sendResult.error) {
          toast.error(tI('email_send_failed', { email }))
        } else {
          toast.success(tI('email_sent', { email }))
        }
      }

      setCreatedUrl(`${baseUrl}/invite/${token}`)
    })
  }

  function handleCopy() {
    if (!createdUrl) return
    navigator.clipboard.writeText(createdUrl).catch(() => toast.error(t('copyFailed')))
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white'
  const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4">
        {createdUrl ? (
          <>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{t('createdTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('createdDesc')}</p>
            <div className="flex items-center gap-2 mb-5">
              <code className="flex-1 text-xs bg-white border border-slate-200 rounded px-3 py-2 text-gray-700 break-all select-all">
                {createdUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="cursor-pointer shrink-0 px-3 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                {t('copy')}
              </button>
            </div>
            <button
              type="button"
              onClick={onCreated}
              className="cursor-pointer w-full py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {t('done')}
            </button>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-gray-900 mb-4">{t('newTitle')}</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelCls}>
                  {t('titleLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder={t('titlePlaceholder')}
                  className={inputCls}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">{t('titleHelp')}</p>
              </div>

              <div>
                <label className={labelCls}>
                  {t('roleLabel')} <span className="text-red-400">*</span>
                </label>
                <select
                  name="role"
                  defaultValue="member"
                  className={inputCls}
                >
                  <option value="member">{t('roleMember')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  {t('emailLabel')} <span className="text-gray-400 font-normal normal-case">{t('emailOptional')}</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={emailValue}
                  onChange={e => setEmailValue(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">{t('emailHelp')}</p>
              </div>

              {availableGroups.length > 1 && (
                <div>
                  <label className={labelCls}>
                    {tI('groups_label')} <span className="text-red-400">*</span>
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
                    {availableGroups.map(group => (
                      <label key={group.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroupIds(prev => [...prev, group.id])
                            } else {
                              setSelectedGroupIds(prev => prev.filter(id => id !== group.id))
                            }
                          }}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{group.name}</span>
                        <span className="text-xs text-slate-400">({group.slug})</span>
                      </label>
                    ))}
                  </div>
                  {selectedGroupIds.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">{tI('groups_required')}</p>
                  )}
                </div>
              )}
              <input type="hidden" name="group_ids" value={JSON.stringify(selectedGroupIds)} />

              <div>
                <label className={labelCls}>
                  {t('localeLabel')} <span className="text-red-400">*</span>
                </label>
                <select
                  name="locale"
                  defaultValue="es"
                  className={inputCls}
                >
                  <option value="es">{t('locale_es')}</option>
                  <option value="en">{t('locale_en')}</option>
                  <option value="it">{t('locale_it')}</option>
                  <option value="ca">{t('locale_ca')}</option>
                  <option value="fr">{t('locale_fr')}</option>
                  <option value="de">{t('locale_de')}</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  {t('expiresLabel')} <span className="text-gray-400 font-normal normal-case">{t('emailOptional')}</span>
                </label>
                <input
                  name="expires_at"
                  type="datetime-local"
                  className={inputCls}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {t('cancel')}
                </button>
                <div className="relative">
                  <button
                    type="submit"
                    disabled={pending}
                    onClick={() => { if (sendOption === 'create_and_send' && !hasEmail) { toast.error(tI('email_required')); return } }}
                    className="cursor-pointer px-4 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-l-lg transition-colors"
                  >
                    {pending ? t('submitting') : sendOption === 'create' ? tI('send_option_create') : tI('send_option_create_and_send')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="cursor-pointer px-2 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 text-white rounded-r-lg border-l border-slate-700 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </button>
                  {showDropdown && (
                    <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                      <button
                        type="button"
                        onClick={() => { setSendOption('create'); setShowDropdown(false) }}
                        className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {tI('send_option_create')}
                      </button>
                      {hasEmail && (
                        <button
                          type="button"
                          onClick={() => { setSendOption('create_and_send'); setShowDropdown(false) }}
                          className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          {tI('send_option_create_and_send')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
