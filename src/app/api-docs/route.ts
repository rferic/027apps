import { ApiReference } from '@scalar/nextjs-api-reference'

const scalarHandler = ApiReference({
  spec: { url: '/openapi.json' },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://027app-eric-rf.vercel.app', description: 'Production' },
  ],
  metaData: {
    title: '027Apps API Documentation',
    description: 'API pública de la plataforma 027Apps',
    ogTitle: '027Apps API Docs',
    ogDescription: 'Explora y prueba la API de 027Apps',
    ogImage: '/logo-icon.png',
  },
  showSidebar: true,
  hideDownloadButton: false,
  hideModels: false,
  defaultOpenAllTags: true,
  authentication: {
    preferredSecurityScheme: 'bearerAuth',
  },
})

const THEME_CSS = `
:root {
  --scalar-color-1: #0f172a;
  --scalar-color-2: #475569;
  --scalar-color-3: #94a3b8;
  --scalar-color-accent: #9B1C1C;
  --scalar-background-1: #ffffff;
  --scalar-background-2: #f8fafc;
  --scalar-background-3: #f1f5f9;
  --scalar-background-accent: #fef2f2;
  --scalar-border-color: #e2e8f0;
  --scalar-button-1: #0f172a;
  --scalar-button-1-color: #ffffff;
  --scalar-button-1-hover: #1e293b;
  --scalar-color-green: #059669;
  --scalar-color-red: #dc2626;
  --scalar-color-yellow: #d97706;
  --scalar-color-blue: #2563eb;
  --scalar-color-orange: #ea580c;
  --scalar-color-purple: #9B1C1C;
  --scalar-sidebar-background-1: #ffffff;
  --scalar-sidebar-item-hover-background: #f1f5f9;
  --scalar-sidebar-item-active-background: #fef2f2;
  --scalar-sidebar-color-active: #9B1C1C;
  --scalar-sidebar-indent-border: #e2e8f0;
  --scalar-sidebar-indent-border-active: #9B1C1C;
}
.dark-mode {
  --scalar-color-1: rgba(255,255,255,0.9);
  --scalar-color-2: rgba(255,255,255,0.6);
  --scalar-color-3: rgba(255,255,255,0.4);
  --scalar-color-accent: #ef4444;
  --scalar-background-1: #0f172a;
  --scalar-background-2: #1e293b;
  --scalar-background-3: #334155;
  --scalar-background-accent: rgba(239,68,68,0.1);
  --scalar-border-color: rgba(255,255,255,0.1);
  --scalar-button-1: #ffffff;
  --scalar-button-1-color: #0f172a;
  --scalar-button-1-hover: #e2e8f0;
  --scalar-color-green: #34d399;
  --scalar-color-red: #f87171;
  --scalar-color-yellow: #fbbf24;
  --scalar-color-blue: #60a5fa;
  --scalar-color-orange: #fb923c;
  --scalar-color-purple: #ef4444;
  --scalar-sidebar-background-1: #0f172a;
  --scalar-sidebar-item-hover-background: #1e293b;
  --scalar-sidebar-item-active-background: rgba(239,68,68,0.1);
  --scalar-sidebar-color-active: #ef4444;
  --scalar-sidebar-indent-border: rgba(255,255,255,0.1);
  --scalar-sidebar-indent-border-active: #ef4444;
}
`

export async function GET() {
  const res = await scalarHandler()
  const html = await res.text()
  const themed = html.replace('</head>', `<style>${THEME_CSS}</style>\n  <link rel="icon" href="/favicon.ico" sizes="any" />\n  <link rel="icon" href="/icon.svg" type="image/svg+xml" />\n</head>`)

  return new Response(themed, {
    headers: { 'Content-Type': 'text/html' },
  })
}
