import { http, HttpResponse } from 'msw'

export const mswHandlers = {
  // Handlers for app API endpoints used by components
  apps: [
    http.get('/api/apps/:slug/logo', () =>
      new HttpResponse(null, { status: 200 })
    ),
    http.get('/api/**', () =>
      HttpResponse.json({ data: [] })
    ),
  ],
}
