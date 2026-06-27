import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

interface Props {
  locale: string
}

export async function AppFooter({ locale }: Props) {
  const t = await getTranslations('nav')

  return (
    <footer className="mt-auto py-6 text-center text-xs text-muted-foreground space-x-4">
      <Link href={`/${locale}/doc`} className="hover:text-foreground transition-colors">
        {t('docs')}
      </Link>
      <span className="text-border">·</span>
      <Link href={`/${locale}/mobile/download`} className="hover:text-foreground transition-colors">
        Mobile App
      </Link>
    </footer>
  )
}
