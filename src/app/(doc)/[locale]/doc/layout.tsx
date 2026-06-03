import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import type { ReactNode } from 'react'
import { source, i18nConfig } from '@/lib/source'
import { DocRootProvider } from './language-provider'
import Image from 'next/image'
import './fumadocs-styles.css'

interface Props {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export default async function DocLayout({ children, params }: Props) {
  const { locale } = await params
  const tree = source.pageTree as Record<string, import('fumadocs-core/page-tree').Root>
  const pageTree = tree[locale] ?? tree[i18nConfig.defaultLanguage]

  return (
    <DocRootProvider locale={locale}>
      <DocsLayout
        tree={pageTree}
        nav={{
          title: (
            <>
              <Image src="/logo.svg" alt="027Apps" width={120} height={28} priority className="dark:hidden" />
              <Image src="/logo-dark.svg" alt="027Apps" width={120} height={28} priority className="hidden dark:block" />
            </>
          ),
        }}
      >
        {children}
      </DocsLayout>
    </DocRootProvider>
  )
}
