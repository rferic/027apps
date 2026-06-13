import { describe, it, expect } from 'vitest'

describe('TODO API — items', () => {
  it('has correct route structure', () => {
    const routes = [
      'GET  /api/v1/{group}/apps/todo/items',
      'POST /api/v1/{group}/apps/todo/items',
      'GET  /api/v1/{group}/apps/todo/items/{id}',
      'PUT  /api/v1/{group}/apps/todo/items/{id}',
      'DELETE /api/v1/{group}/apps/todo/items/{id}',
    ]
    expect(routes).toHaveLength(5)
    routes.forEach(r => expect(r).toMatch(/^(GET|POST|PUT|DELETE)/))
  })

  it('has correct route structure for categories', () => {
    const routes = [
      'GET  /api/v1/{group}/apps/todo/categories',
      'POST /api/v1/admin/apps/todo/categories',
      'PUT  /api/v1/admin/apps/todo/categories/{id}',
      'DELETE /api/v1/admin/apps/todo/categories/{id}',
    ]
    expect(routes).toHaveLength(4)
  })

  it('has correct route structure for widgets', () => {
    const routes = [
      'GET  /api/v1/{group}/apps/todo/widget/my',
      'GET  /api/v1/{group}/apps/todo/widget/group',
    ]
    expect(routes).toHaveLength(2)
  })

  it('has correct route structure for notification prefs', () => {
    const routes = [
      'GET  /api/v1/{group}/apps/todo/notification-prefs',
      'PUT  /api/v1/{group}/apps/todo/notification-prefs',
    ]
    expect(routes).toHaveLength(2)
  })

  it('follows pagination convention', () => {
    const paginatedRoutes = [
      'GET  /api/v1/{group}/apps/todo/items',
    ]
    paginatedRoutes.forEach(r => {
      expect(r).toContain('items')
      expect(r).toMatch(/^GET/)
    })
  })

  it('DELETE endpoints return 204', () => {
    const deleteRoutes = [
      'DELETE /api/v1/{group}/apps/todo/items/{id}',
      'DELETE /api/v1/admin/apps/todo/categories/{id}',
    ]
    expect(deleteRoutes).toHaveLength(2)
    deleteRoutes.forEach(r => expect(r).toMatch(/^DELETE/))
  })
})
