'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { updateAppOrderAction } from './actions'

interface AppItem {
  slug: string
  name: string
  primaryColor: string
}

interface Props {
  initialApps: AppItem[]
}

function SortableApp({ app }: { app: AppItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.slug })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 ${
        isDragging ? 'shadow-lg z-50 ring-2 ring-rose-200 border-rose-300' : ''
      }`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <img
        src={`/api/apps/${app.slug}/logo`}
        alt={app.name}
        className="w-7 h-7 rounded flex-shrink-0"
        onError={(e) => {
          const target = e.currentTarget
          target.style.display = 'none'
          const fallback = target.nextElementSibling
          if (fallback instanceof HTMLElement) fallback.style.display = 'flex'
        }}
      />
      <div
        className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ backgroundColor: app.primaryColor, display: 'none' }}
      >
        {app.name.slice(0, 2).toUpperCase()}
      </div>
      <span className="text-sm font-medium text-slate-700">{app.name}</span>
    </div>
  )
}

export function AppsOrderManager({ initialApps }: Props) {
  const t = useTranslations('admin.settings.apps')
  const [apps, setApps] = useState(initialApps)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setApps((items) => {
        const oldIndex = items.findIndex((item) => item.slug === active.id)
        const newIndex = items.findIndex((item) => item.slug === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    const orderedSlugs = apps.map((a) => a.slug)
    const result = await updateAppOrderAction(orderedSlugs)
    setSaving(false)

    if ('error' in result && result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('saved'))
    }
  }

  const hasChanges =
    apps.map((a) => a.slug).join(',') !==
    initialApps.map((a) => a.slug).join(',')

  if (apps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
        <p className="text-sm text-slate-400">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={apps.map((a) => a.slug)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {apps.map((app) => (
              <SortableApp key={app.slug} app={app} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? t('saving') : t('save')}
      </button>
    </div>
  )
}
