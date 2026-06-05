'use client'
import Image from 'next/image'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Package } from 'lucide-react'

function AppIcon({ slug, name, primaryColor }: { slug: string; name: string; primaryColor: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
        style={{ backgroundColor: primaryColor }}
      >
        {slug.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <Image unoptimized
      src={`/api/apps/${slug}/logo`}
      alt={name}
      className="w-10 h-10 rounded-lg shrink-0"
      onError={() => setFailed(true)}
    />
  )
}

interface AppWidgetData {
  slug: string
  name: string
  description: string
  primaryColor: string
  secondaryColor: string
}

interface Props {
  apps: AppWidgetData[]
  locale: string
  groupSlug?: string
}

export function AppInstalledWidget({ apps, locale, groupSlug }: Props) {
  const t = useTranslations('app')

  const appHref = (slug: string) =>
    groupSlug ? `/${locale}/${groupSlug}/apps/${slug}` : `/${locale}/apps/${slug}`

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        {t('dashboard.apps_widget_title')}
      </h2>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-slate-100">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Package className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">
            {t('dashboard.apps_widget_empty')}
          </p>
          <p className="text-xs text-slate-400 max-w-xs">
            {t('dashboard.apps_widget_empty_hint')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {apps.map((app) => (
            <Link
              key={app.slug}
              href={appHref(app.slug)}
              className="group bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <AppIcon slug={app.slug} name={app.name} primaryColor={app.primaryColor} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate group-hover:text-slate-700">
                    {app.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {app.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
