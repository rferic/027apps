'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { DsCheckbox } from '@/components/ds/checkbox'
import { createGroupWithWizardAction } from './actions'
import { getUsersForWizardAction } from '../group-detail-actions'

interface WizardUser {
  id: string
  email: string
  displayName: string
}

export default function NewGroupWizardPage() {
  const t = useTranslations('admin')
  const tWizard = useTranslations('admin.groups')
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const [step, setStep] = useState(1)
  const [pending, startTransition] = useTransition()

  // Step 1: Group info
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  // Step 2: Select members
  const [users, setUsers] = useState<WizardUser[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userFilter, setUserFilter] = useState('')

  // Step 3: Review & apps
  const [selectedApps] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    getUsersForWizardAction()
      .then(u => { if (!cancelled) setUsers(u) })
      .catch(() => { if (!cancelled) toast.error('Failed to load users') })
    return () => { cancelled = true }
  }, [])

  const filteredUsers = useMemo(() => {
    if (!userFilter.trim()) return users
    const q = userFilter.toLowerCase()
    return users.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  }, [users, userFilter])

  function toggleUser(userId: string) {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50)
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('slug', slug)
      formData.append('userIds', JSON.stringify(selectedUserIds))
      formData.append('apps', JSON.stringify(selectedApps))

      const result = await createGroupWithWizardAction(formData)
      if ('error' in result) {
        const errorMap: Record<string, string> = {
          name_slug_required: 'error_name_slug_required',
          slug_invalid: 'error_slug_invalid',
          slug_exists: 'error_slug_exists',
        }
        toast.error(tWizard(errorMap[result.error] ?? 'error_unknown'))
      } else {
        toast.success(tWizard('success'))
        router.push(`/${locale}/admin/groups/${result.groupId}`)
      }
    })
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white'
  const labelCls = 'block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5'

  return (
    <div className="min-h-screen bg-muted">
      {/* Steps indicator */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s <= step ? 'bg-foreground text-white' : 'bg-muted text-slate-400'
              }`}>
                {s}
              </div>
              <span className={`text-sm font-medium ${s <= step ? 'text-slate-900' : 'text-slate-400'}`}>
                {s === 1 ? tWizard('wizard_step_group') : s === 2 ? tWizard('wizard_step_members') : tWizard('wizard_step_apps')}
              </span>
              {s < 3 && <div className="w-8 h-px bg-slate-200 mx-2" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6">
        {step === 1 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tWizard('wizard_create_title')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tWizard('wizard_create_subtitle')}</p>
            </div>

            <div>
              <label className={labelCls}>{tWizard('wizard_name_label')} <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder={tWizard('wizard_name_placeholder')}
                required
                className={inputCls}
                autoFocus
              />
            </div>

            <div>
              <label className={labelCls}>{tWizard('wizard_slug_label')} <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/g, '').toLowerCase())}
                placeholder={tWizard('wizard_slug_placeholder')}
                required
                pattern="^[a-z0-9-]+$"
                className={inputCls}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {tWizard('wizard_slug_hint', { locale, slug: slug || generateSlug(name) })}
              </p>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => { if (name && slug) setStep(2) }}
                disabled={!name.trim() || !slug.trim()}
                className="px-4 py-2 text-sm font-medium bg-foreground hover:bg-foreground disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {tWizard('wizard_next_members')}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tWizard('wizard_select_members_title')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tWizard('wizard_select_members_subtitle')}</p>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                placeholder={tWizard('wizard_filter_users_placeholder')}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-card"
              />
            </div>

            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tWizard('wizard_no_members')}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-lg p-1">
                {filteredUsers.map(user => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  >
                    <DsCheckbox checked={selectedUserIds.includes(user.id)} onChange={() => toggleUser(user.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{user.displayName}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {selectedUserIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {tWizard('wizard_selected_count', { count: selectedUserIds.length })}
              </p>
            )}

            <div className="pt-3 border-t border-border flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {tWizard('wizard_back')}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {tWizard('wizard_skip')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-sm font-medium bg-foreground hover:bg-foreground text-white rounded-lg transition-colors"
                >
                  {tWizard('wizard_next_review')}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tWizard('wizard_review_title')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tWizard('wizard_review_subtitle')}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-muted-foreground">{tWizard('wizard_field_name')}</span>
                <span className="font-medium text-foreground">{name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-muted-foreground">{tWizard('wizard_field_slug')}</span>
                <span className="font-medium text-foreground font-mono">{slug}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-muted-foreground">{tWizard('wizard_field_url')}</span>
                <span className="font-medium text-foreground font-mono text-xs">/{locale}/{slug}/dashboard</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-muted-foreground">{tWizard('wizard_field_members')}</span>
                <span className="font-medium text-foreground">
                  {selectedUserIds.length}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {tWizard('wizard_back')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="px-6 py-2 text-sm font-medium bg-foreground hover:bg-foreground disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {pending ? tWizard('wizard_creating') : tWizard('wizard_create')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
