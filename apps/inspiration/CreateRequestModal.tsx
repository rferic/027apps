'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  X, Bug, Sparkles, AppWindow, Puzzle, Lightbulb, MoreHorizontal,
  ChevronLeft, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

type RequestType = 'bug' | 'improvement' | 'new_app' | 'new_app_feature' | 'new_general_functionality' | 'other'

interface InstalledApp {
  slug: string
  name: string
}

interface CreateRequestModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  groupSlug: string
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white transition-colors placeholder:text-slate-400'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

export default function CreateRequestModal({ open, onClose, onCreated, groupSlug }: CreateRequestModalProps) {
  const t = useTranslations('apps.inspiration')

  const REQUEST_TYPES = [
    { value: 'bug', label: t('types.bug'), description: t('create.step1_bug_desc'), icon: Bug, color: '#EF4444' },
    { value: 'improvement', label: t('types.improvement'), description: t('create.step1_improvement_desc'), icon: Sparkles, color: '#F59E0B' },
    { value: 'new_app', label: t('types.new_app'), description: t('create.step1_new_app_desc'), icon: AppWindow, color: '#8B5CF6' },
    { value: 'new_app_feature', label: t('types.new_app_feature'), description: t('create.step1_feature_desc'), icon: Puzzle, color: '#3B82F6' },
    { value: 'new_general_functionality', label: t('types.new_general_functionality'), description: t('create.step1_general_desc'), icon: Lightbulb, color: '#10B981' },
    { value: 'other', label: t('types.other'), description: t('create.step1_other_desc'), icon: MoreHorizontal, color: '#6B7280' },
  ] as const

  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<RequestType | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [appSlug, setAppSlug] = useState('')

  // Type-specific extra fields
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [actualBehavior, setActualBehavior] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [proposedName, setProposedName] = useState('')
  const [appDescription, setAppDescription] = useState('')
  const [featureAppSlug, setFeatureAppSlug] = useState('')

  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch installed apps when modal opens
  useEffect(() => {
    if (!open) return
    fetch(`/api/v1/${groupSlug}/apps/inspiration/apps`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setInstalledApps(data.apps ?? []))
      .catch(() => setInstalledApps([]))
  }, [open, groupSlug])

  // Handle escape key
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const reset = useCallback(() => {
    setStep(1)
    setSelectedType(null)
    setTitle('')
    setDescription('')
    setAppSlug('')
    setStepsToReproduce('')
    setExpectedBehavior('')
    setActualBehavior('')
    setSuggestion('')
    setProposedName('')
    setAppDescription('')
    setFeatureAppSlug('')
    setError(null)
    setSubmitting(false)
  }, [])

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelectType(type: RequestType) {
    setSelectedType(type)
    setStep(2)
  }

  function handleBack() {
    if (step === 2) {
      setStep(1)
      setError(null)
    } else if (step === 3) {
      setStep(2)
      setError(null)
    }
  }

  // Build the full description merging extra fields
  function buildDescription(): string {
    let full = description.trim()
    const type = selectedType!

    if (type === 'bug') {
      if (stepsToReproduce.trim()) full += `\n\n---\n**${t('create.bug_steps_label')}:**\n${stepsToReproduce.trim()}`
      if (expectedBehavior.trim()) full += `\n\n**${t('create.bug_expected_label')}:**\n${expectedBehavior.trim()}`
      if (actualBehavior.trim()) full += `\n\n**${t('create.bug_actual_label')}:**\n${actualBehavior.trim()}`
    }
    if (type === 'improvement') {
      if (suggestion.trim()) full += `\n\n---\n**${t('create.improvement_label')}:**\n${suggestion.trim()}`
    }
    if (type === 'new_app') {
      if (proposedName.trim()) full += `\n\n---\n**${t('create.new_app_title_label')}:** ${proposedName.trim()}`
      if (appDescription.trim()) full += `\n\n**${t('create.new_app_description_label')}:**\n${appDescription.trim()}`
    }
    if (type === 'new_app_feature') {
      if (appDescription.trim()) full += `\n\n---\n**${t('create.feature_details_label')}:**\n${appDescription.trim()}`
    }
    return full
  }

  function canGoToStep3(): boolean {
    if (!title.trim()) return false
    if (!description.trim()) return false
    if (selectedType === 'new_app' && !proposedName.trim()) return false
    if (selectedType === 'new_app_feature' && !featureAppSlug) return false
    return true
  }

  // Determine effective app slug (feature type uses its own, others use the general one)
  function getEffectiveAppSlug(): string {
    if (selectedType === 'new_app_feature') return featureAppSlug
    return appSlug
  }

  function handleNext() {
    if (!canGoToStep3()) return
    setError(null)
    setStep(3)
  }

  async function handleSubmit() {
    if (!selectedType) return
    setSubmitting(true)
    setError(null)

    const body: Record<string, string> = {
      title: title.trim(),
      description: buildDescription(),
      type: selectedType,
    }

    const effectiveAppSlug = getEffectiveAppSlug()
    if (effectiveAppSlug) body.app_slug = effectiveAppSlug

    try {
      const res = await fetch(`/api/v1/${groupSlug}/apps/inspiration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: t('create.request_failed') }))
        throw new Error(err.message || `Error ${res.status}`)
      }

      toast.success(t('create.success'))
      reset()
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('create.publish_error')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const typeMeta = selectedType ? REQUEST_TYPES.find(t => t.value === selectedType)! : null
  const step1only = step === 1
  const step2only = step === 2
  const step3only = step === 3

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 animate-in fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1 -ml-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h2 className="text-base font-semibold text-slate-900">
              {step1only && t('create.step1_title')}
              {step2only && typeMeta && (
                <span className="flex items-center gap-2">
                  <typeMeta.icon size={18} style={{ color: typeMeta.color }} />
                  {typeMeta.label}
                </span>
              )}
              {step3only && t('create.step3_title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-5">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-violet-500' : 'bg-slate-200'}`}
            />
          ))}
          <span className="text-xs text-slate-400 ml-2 tabular-nums">{t('create.step_label', { step })}</span>
        </div>

        {/* =========== STEP 1: Type selection =========== */}
        {step1only && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REQUEST_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleSelectType(t.value)}
                className="flex items-start gap-3 p-4 rounded-xl border-2 border-slate-100 hover:border-violet-200 hover:shadow-sm text-left cursor-pointer transition-all group"
                style={{
                  borderLeftColor: t.color,
                  borderLeftWidth: '3px',
                }}
              >
                <div className="rounded-lg p-1.5 shrink-0" style={{ backgroundColor: `${t.color}14` }}>
                  <t.icon size={22} style={{ color: t.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* =========== STEP 2: Form =========== */}
        {step2only && (
          <div className="space-y-4">
            {/* Title — common */}
            <div>
              <label className={labelCls}>{t('create.title_label')} <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('create.title_placeholder')}
                className={inputCls}
                autoFocus
              />
            </div>

            {/* Description — common */}
            <div>
              <label className={labelCls}>{t('create.description_label')} <span className="text-red-400">*</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('create.description_placeholder')}
                rows={4}
                className={inputCls + ' resize-y'}
              />
            </div>

            {/* App slug dropdown — common, optional (except for new_app_feature where it's required) */}
            <div>
              <label className={labelCls}>
                {selectedType === 'new_app_feature' ? (
                  <>{t('create.feature_app_label')} <span className="text-red-400">*</span></>
                ) : selectedType === 'improvement' ? (
                  <>{t('create.improvement_app_label')}</>
                ) : selectedType === 'bug' ? (
                  <>{t('create.bug_app_label')}</>
                ) : (
                  <>{t('create.app_label')}</>
                )}
              </label>
              {installedApps.length === 0 ? (
                <p className="text-xs text-slate-400">{t('create.no_apps')}</p>
              ) : (
                <select
                  value={selectedType === 'new_app_feature' ? featureAppSlug : appSlug}
                  onChange={e => {
                    if (selectedType === 'new_app_feature') {
                      setFeatureAppSlug(e.target.value)
                    } else {
                      setAppSlug(e.target.value)
                    }
                  }}
                  className={inputCls}
                >
                  <option value="">{t('create.app_placeholder')}</option>
                  {installedApps.map(app => (
                    <option key={app.slug} value={app.slug}>{app.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* === Bug extra fields === */}
            {selectedType === 'bug' && (
              <>
                <div>
                  <label className={labelCls}>{t('create.bug_steps_label')}</label>
                  <textarea
                    value={stepsToReproduce}
                    onChange={e => setStepsToReproduce(e.target.value)}
                    placeholder={t('create.bug_steps_placeholder')}
                    rows={3}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('create.bug_expected_label')}</label>
                  <textarea
                    value={expectedBehavior}
                    onChange={e => setExpectedBehavior(e.target.value)}
                    placeholder={t('create.bug_expected_placeholder')}
                    rows={2}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('create.bug_actual_label')}</label>
                  <textarea
                    value={actualBehavior}
                    onChange={e => setActualBehavior(e.target.value)}
                    placeholder={t('create.bug_actual_placeholder')}
                    rows={2}
                    className={inputCls + ' resize-y'}
                  />
                </div>
              </>
            )}

            {/* === Improvement extra fields === */}
            {selectedType === 'improvement' && (
              <div>
                <label className={labelCls}>{t('create.improvement_label')}</label>
                <textarea
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder={t('create.improvement_placeholder')}
                  rows={3}
                  className={inputCls + ' resize-y'}
                />
              </div>
            )}

            {/* === New app extra fields === */}
            {selectedType === 'new_app' && (
              <>
                <div>
                  <label className={labelCls}>{t('create.new_app_title_label')} <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={proposedName}
                    onChange={e => setProposedName(e.target.value)}
                    placeholder={t('create.new_app_title_placeholder')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('create.new_app_description_label')}</label>
                  <textarea
                    value={appDescription}
                    onChange={e => setAppDescription(e.target.value)}
                    placeholder={t('create.new_app_description_placeholder')}
                    rows={3}
                    className={inputCls + ' resize-y'}
                  />
                </div>
              </>
            )}

            {/* === App feature extra fields === */}
            {selectedType === 'new_app_feature' && (
              <div>
                <label className={labelCls}>{t('create.feature_details_label')}</label>
                <textarea
                  value={appDescription}
                  onChange={e => setAppDescription(e.target.value)}
                  placeholder={t('create.feature_details_placeholder')}
                  rows={3}
                  className={inputCls + ' resize-y'}
                />
              </div>
            )}

            {/* Next button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
              >
                {t('create.cancel')}
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoToStep3()}
                className="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer transition-colors"
              >
                {t('create.review')}
              </button>
            </div>
          </div>
        )}

        {/* =========== STEP 3: Confirm =========== */}
        {step3only && typeMeta && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-24 shrink-0">{t('create.type_colon')}</span>
                <span className="flex items-center gap-1.5 font-medium" style={{ color: typeMeta.color }}>
                  <typeMeta.icon size={14} />
                  {typeMeta.label}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 w-24 shrink-0">{t('create.title_colon')}</span>
                <span className="text-slate-800 font-medium">{title.trim()}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 w-24 shrink-0">{t('create.description_colon')}</span>
                <span className="text-slate-700 line-clamp-3 whitespace-pre-line">
                  {buildDescription()}
                </span>
              </div>
              {getEffectiveAppSlug() && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-24 shrink-0">{t('create.app_colon')}</span>
                  <span className="text-slate-700">
                    {installedApps.find(a => a.slug === getEffectiveAppSlug())?.name ?? getEffectiveAppSlug()}
                  </span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors disabled:opacity-50"
              >
                {t('create.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('create.publishing')}
                  </>
                ) : (
                  t('create.submit')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
