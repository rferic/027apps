import { ApiReference } from '@scalar/nextjs-api-reference'

export const GET = ApiReference({
  spec: { url: '/openapi.json' },
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  theme: 'purple',
  showSidebar: true,
  hideDownloadButton: false,
  authentication: {
    preferredSecurityScheme: 'bearerAuth',
  },
})
