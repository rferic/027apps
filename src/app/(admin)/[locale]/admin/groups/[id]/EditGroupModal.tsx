'use client'

import { useTransition, useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { updateGroupAction } from './actions'

interface Props {
  isOpen: boolean
  onClose: () => void
  groupId: string
  currentName: string
  currentSlug: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function EditGroupModal({ isOpen, onClose, groupId, currentName, currentSlug }: Props) {
  const t = useTranslations('admin')
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(currentName)
  const [slug, setSlug] = useState(currentSlug)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Resetear campos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      startTransition(() => {
        setName(currentName)
        setSlug(currentSlug)
        setSlugManuallyEdited(false)
      })
    }
  }, [isOpen, currentName, currentSlug])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugManuallyEdited(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateGroupAction(groupId, formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Grupo actualizado')
        onClose()
        router.refresh()
      }
    })
  }

  if (!isOpen) return null

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white'
  const labelCls = 'block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 bg-white rounded-xl border border-slate-100 shadow-xl p-6 w-full max-w-lg mx-4">
        {/* Header con X */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Editar grupo</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre */}
          <div>
            <label htmlFor="edit-group-name" className={labelCls}>
              {t('groups.wizard_name_label')}
            </label>
            <input
              id="edit-group-name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="edit-group-slug" className={labelCls}>
              {t('groups.wizard_slug_label')}
            </label>
            <input
              id="edit-group-slug"
              name="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              pattern="^[a-z0-9-]+$"
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">
              {t('groups.wizard_slug_hint', { locale, slug })}
            </p>
          </div>

          {/* Acciones */}
          <div className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer px-4 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
