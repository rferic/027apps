'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Bug, Sparkles, AppWindow, Puzzle, Lightbulb, MoreHorizontal,
  ChevronLeft, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// Type definitions
const REQUEST_TYPES = [
  { value: 'bug', label: 'Bug report', description: 'Report a bug or issue', icon: Bug, color: '#EF4444' },
  { value: 'improvement', label: 'Improvement', description: 'Suggest an improvement', icon: Sparkles, color: '#F59E0B' },
  { value: 'new_app', label: 'New app', description: 'Propose a new app', icon: AppWindow, color: '#8B5CF6' },
  { value: 'new_app_feature', label: 'App feature', description: 'New feature for an app', icon: Puzzle, color: '#3B82F6' },
  { value: 'new_general_functionality', label: 'General functionality', description: 'Platform-wide idea', icon: Lightbulb, color: '#10B981' },
  { value: 'other', label: 'Other', description: 'Anything else', icon: MoreHorizontal, color: '#6B7280' },
] as const

type RequestType = typeof REQUEST_TYPES[number]['value']

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
      if (stepsToReproduce.trim()) full += `\n\n---\n**Steps to reproduce:**\n${stepsToReproduce.trim()}`
      if (expectedBehavior.trim()) full += `\n\n**Expected behavior:**\n${expectedBehavior.trim()}`
      if (actualBehavior.trim()) full += `\n\n**Actual behavior:**\n${actualBehavior.trim()}`
    }
    if (type === 'improvement') {
      if (suggestion.trim()) full += `\n\n---\n**Suggestion:**\n${suggestion.trim()}`
    }
    if (type === 'new_app') {
      if (proposedName.trim()) full += `\n\n---\n**Proposed name:** ${proposedName.trim()}`
      if (appDescription.trim()) full += `\n\n**What it would do:**\n${appDescription.trim()}`
    }
    if (type === 'new_app_feature') {
      if (appDescription.trim()) full += `\n\n---\n**Feature details:**\n${appDescription.trim()}`
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
        const err = await res.json().catch(() => ({ message: 'Request failed' }))
        throw new Error(err.message || `Error ${res.status}`)
      }

      toast.success('Idea published successfully')
      reset()
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
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
        className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in"
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
              {step1only && 'What do you want to propose?'}
              {step2only && typeMeta && (
                <span className="flex items-center gap-2">
                  <typeMeta.icon size={18} style={{ color: typeMeta.color }} />
                  {typeMeta.label}
                </span>
              )}
              {step3only && 'Review your idea'}
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
          <span className="text-xs text-slate-400 ml-2 tabular-nums">Step {step} of 3</span>
        </div>

        {/* =========== STEP 1: Type selection =========== */}
        {step1only && (
          <div className="grid grid-cols-2 gap-3">
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
              <label className={labelCls}>Title <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Give your idea a short, clear title"
                className={inputCls}
                autoFocus
              />
            </div>

            {/* Description — common */}
            <div>
              <label className={labelCls}>Description <span className="text-red-400">*</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Explain your idea in detail..."
                rows={4}
                className={inputCls + ' resize-y'}
              />
            </div>

            {/* App slug dropdown — common, optional (except for new_app_feature where it's required) */}
            <div>
              <label className={labelCls}>
                {selectedType === 'new_app_feature' ? (
                  <>Which app? <span className="text-red-400">*</span></>
                ) : selectedType === 'bug' || selectedType === 'improvement' ? (
                  <>Related app <span className="text-slate-400 font-normal">(optional)</span></>
                ) : (
                  <>Assign to app <span className="text-slate-400 font-normal">(optional)</span></>
                )}
              </label>
              {installedApps.length === 0 ? (
                <p className="text-xs text-slate-400">No apps available</p>
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
                  <option value="">-- Select an app --</option>
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
                  <label className={labelCls}>Steps to reproduce</label>
                  <textarea
                    value={stepsToReproduce}
                    onChange={e => setStepsToReproduce(e.target.value)}
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                    rows={3}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div>
                  <label className={labelCls}>What did you expect?</label>
                  <textarea
                    value={expectedBehavior}
                    onChange={e => setExpectedBehavior(e.target.value)}
                    placeholder="I expected..."
                    rows={2}
                    className={inputCls + ' resize-y'}
                  />
                </div>
                <div>
                  <label className={labelCls}>What actually happened?</label>
                  <textarea
                    value={actualBehavior}
                    onChange={e => setActualBehavior(e.target.value)}
                    placeholder="Instead, this happened..."
                    rows={2}
                    className={inputCls + ' resize-y'}
                  />
                </div>
              </>
            )}

            {/* === Improvement extra fields === */}
            {selectedType === 'improvement' && (
              <div>
                <label className={labelCls}>Suggestion</label>
                <textarea
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder="How would you improve it?"
                  rows={3}
                  className={inputCls + ' resize-y'}
                />
              </div>
            )}

            {/* === New app extra fields === */}
            {selectedType === 'new_app' && (
              <>
                <div>
                  <label className={labelCls}>Proposed name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={proposedName}
                    onChange={e => setProposedName(e.target.value)}
                    placeholder="What should we call it?"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>What would it do?</label>
                  <textarea
                    value={appDescription}
                    onChange={e => setAppDescription(e.target.value)}
                    placeholder="Describe what the app would do..."
                    rows={3}
                    className={inputCls + ' resize-y'}
                  />
                </div>
              </>
            )}

            {/* === App feature extra fields === */}
            {selectedType === 'new_app_feature' && (
              <div>
                <label className={labelCls}>Feature details</label>
                <textarea
                  value={appDescription}
                  onChange={e => setAppDescription(e.target.value)}
                  placeholder="Describe the feature you'd like to see..."
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoToStep3()}
                className="px-5 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer transition-colors"
              >
                Review
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
                <span className="text-slate-500 w-24 shrink-0">Type:</span>
                <span className="flex items-center gap-1.5 font-medium" style={{ color: typeMeta.color }}>
                  <typeMeta.icon size={14} />
                  {typeMeta.label}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 w-24 shrink-0">Title:</span>
                <span className="text-slate-800 font-medium">{title.trim()}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 w-24 shrink-0">Description:</span>
                <span className="text-slate-700 line-clamp-3 whitespace-pre-line">
                  {buildDescription()}
                </span>
              </div>
              {getEffectiveAppSlug() && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-24 shrink-0">App:</span>
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
                Cancel
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
                    Publishing...
                  </>
                ) : (
                  'Publish idea'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
