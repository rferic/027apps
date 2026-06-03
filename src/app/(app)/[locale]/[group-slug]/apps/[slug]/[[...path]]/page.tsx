import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { loadAppModule } from '@/lib/apps/registry'

const SLUG_RE = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ locale: string; 'group-slug': string; slug: string; path?: string[] }>
}

export default async function AppViewPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  if (!SLUG_RE.test(slug)) notFound()

  let ViewComponent: React.ComponentType
  try {
    ViewComponent = await loadAppModule(slug, 'view')
  } catch {
    notFound()
  }

  return <ViewComponent />
}
