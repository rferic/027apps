'use client'

import { Bug, Sparkles, AppWindow, Puzzle, Lightbulb, MoreHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface HotIdea {
  id: string
  title: string
  type: string
  vote_count: number
  comment_count: number
}

const TYPE_META: Record<string, { color: string; icon: React.ComponentType<{ size?: number }> }> = {
  bug: { color: '#EF4444', icon: Bug },
  improvement: { color: '#F59E0B', icon: Sparkles },
  new_app: { color: '#8B5CF6', icon: AppWindow },
  new_app_feature: { color: '#3B82F6', icon: Puzzle },
  new_general_functionality: { color: '#10B981', icon: Lightbulb },
  other: { color: '#6B7280', icon: MoreHorizontal },
}

export default function HotIdeasList({ ideas }: { ideas: HotIdea[] }) {
  const t = useTranslations('admin.dashboard')

  return (
    <ul className="space-y-2">
      {ideas.map((idea) => {
        const meta = TYPE_META[idea.type] ?? TYPE_META.other
        const Icon = meta.icon
        return (
          <li key={idea.id} className="flex items-center gap-2 text-sm">
            <span className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0" style={{ backgroundColor: meta.color + '18', color: meta.color }}>
              <Icon size={10} />
            </span>
            <span className="text-slate-700 truncate flex-1 min-w-0">{idea.title}</span>
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
              <span>{t('votes', { count: idea.vote_count })}</span>
              <span>{t('comments', { count: idea.comment_count })}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
