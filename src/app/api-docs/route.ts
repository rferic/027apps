import { ApiReference } from '@scalar/nextjs-api-reference'

export const GET = ApiReference({
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
  theme: 'purple',
  showSidebar: true,
  hideDownloadButton: false,
  hideModels: false,
  defaultOpenAllTags: true,
  authentication: {
    preferredSecurityScheme: 'bearerAuth',
  },
})
