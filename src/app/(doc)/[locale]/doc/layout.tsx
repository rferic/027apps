import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import type { ReactNode } from 'react'
import { source, i18nConfig } from '@/lib/source'
import { DocRootProvider } from './language-provider'
import Image from 'next/image'
import 'fumadocs-ui/style.css'

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
      <style>{`
        :root {
          --color-fd-primary: #9B1C1C;
          --color-fd-primary-foreground: #fff;
          --color-fd-ring: #9B1C1C;
        }
        [data-fd-toc] .border-s { border-left: none !important; }
        [data-fd-toc] a { padding-left: 0.5rem !important; }
        .fd-content p { margin-bottom: 1.25rem !important; line-height: 1.75 !important; }
        .fd-content hr { margin: 2rem 0 !important; }
        .fd-content h2 { margin-top: 2.5rem !important; margin-bottom: 1rem !important; }
        .fd-content h3 { margin-top: 2rem !important; margin-bottom: 0.75rem !important; }
        .fd-content td, .fd-content th { padding: 0.75rem 1rem !important; }
        .fd-content .fd-card { border-radius: 0.375rem !important; }
        .fd-content pre { border-radius: 0.375rem !important; }
        aside a[href*='/apps/inspiration'] { position: relative; padding-left: 1.25rem !important; }
        aside a[href*='/apps/inspiration']::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: #F59E0B; }
        aside a[href*='/apps/todo'] { position: relative; padding-left: 1.25rem !important; }
        aside a[href*='/apps/todo']::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: #4F46E5; }
      `}</style>
    </DocRootProvider>
  )
}
