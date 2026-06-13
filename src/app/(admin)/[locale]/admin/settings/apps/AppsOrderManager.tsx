'use client'
import Image from 'next/image'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
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
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 touch-none"
        style={{ touchAction: 'none' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <Image unoptimized
        src={`/api/apps/${app.slug}/logo`}
        alt={app.name}
        width={28}
        height={28}
        className="w-7 h-7 rounded flex-shrink-0"
        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
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
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = apps.findIndex((item) => item.slug === active.id)
      const newIndex = apps.findIndex((item) => item.slug === over.id)
      const reordered = arrayMove(apps, oldIndex, newIndex)

      // Update local state immediately for smooth UX
      setApps(reordered)
      setSaving(true)

      const orderedSlugs = reordered.map((a) => a.slug)
      const result = await updateAppOrderAction(orderedSlugs)
      setSaving(false)

      if ('error' in result && result.error) {
        // Rollback local state on error
        setApps(apps)
        toast.error(result.error)
      } else {
        toast.success(t('saved'))
      }
    },
    [apps, t]
  )

  if (apps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
        <p className="text-sm text-slate-400">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div>
      {saving && (
        <div className="flex items-center justify-end gap-2 mb-3">
          <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">{t('saving')}</span>
        </div>
      )}
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
    </div>
  )
}
