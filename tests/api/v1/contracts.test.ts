import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { apiContract } from '@/contracts'

const committed = JSON.parse(readFileSync('public/openapi.json', 'utf-8'))

describe('OpenAPI generation', () => {
  it('generated spec contains all 5 endpoints', async () => {
    const { generateOpenApi } = await import('@ts-rest/open-api')
    const doc = generateOpenApi(apiContract, {
      info: { title: 'Test', version: '1.0.0' },
    })

    expect(doc.paths).toHaveProperty('/api/v1')
    expect(doc.paths).toHaveProperty('/api/v1/apps')
    expect(doc.paths).toHaveProperty('/api/v1/me')
    expect(doc.paths).toHaveProperty('/api/v1/locales')
    expect(doc.paths).toHaveProperty('/api/v1/admin/apps/todo')
  })

  it('committed spec has same endpoints as generated spec', async () => {
    const { generateOpenApi } = await import('@ts-rest/open-api')
    const doc = generateOpenApi(apiContract, {
      info: { title: 'Test', version: '1.0.0' },
    })

    const genPaths = Object.keys(doc.paths).sort()
    const comPaths = Object.keys(committed.paths).sort()
    expect(comPaths).toEqual(genPaths)
  })
})

describe('security schemes in committed openapi.json', () => {
  it('apps endpoint accepts bearerAuth and apiKey', () => {
    const security = committed.paths['/api/v1/apps'].get.security as Record<string, string[]>[]
    expect(security).toContainEqual({ bearerAuth: [] })
    expect(security).toContainEqual({ apiKey: [] })
  })

  it('me endpoint only accepts bearerAuth', () => {
    const security = committed.paths['/api/v1/me'].get.security as Record<string, string[]>[]
    expect(security).toContainEqual({ bearerAuth: [] })
    expect(security).not.toContainEqual({ apiKey: [] })
  })

  it('admin/todo endpoint only accepts bearerAuth', () => {
    const security = committed.paths['/api/v1/admin/apps/todo'].get.security as Record<string, string[]>[]
    expect(security).toContainEqual({ bearerAuth: [] })
    expect(security).not.toContainEqual({ apiKey: [] })
  })

  it('health endpoint has no security', () => {
    const security = committed.paths['/api/v1'].get.security as Record<string, string[]>[]
    expect(security).toBeUndefined()
  })

  it('locales endpoint has no security', () => {
    const security = committed.paths['/api/v1/locales'].get.security as Record<string, string[]>[]
    expect(security).toBeUndefined()
  })
})

describe('auth header vs security scheme sync', () => {
  it('all paths with auth headers have security schemes in openapi.json', () => {
    const pathsWithAuth: string[] = []
    const router = apiContract as Record<string, unknown>

    function walk(obj: Record<string, unknown>) {
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') {
          const v = val as Record<string, unknown>
          if (v.path && v.headers) {
            const headers = v.headers as Record<string, unknown>
            if (Object.keys(headers).length > 0) {
              pathsWithAuth.push(v.path as string)
            }
          }
          walk(v)
        }
      }
    }
    walk(router)

    for (const path of pathsWithAuth) {
      const methods = committed.paths[path] as Record<string, unknown> | undefined
      expect(methods, `Path ${path} not found in openapi.json`).toBeDefined()
      const getMethod = methods?.get as Record<string, unknown> | undefined
      const security = getMethod?.security as Record<string, string[]>[]
      expect(security, `Path ${path} has no security scheme`).toBeDefined()
      expect(security!.length > 0, `Path ${path} has empty security schemes`).toBe(true)
    }
  })
})

describe('contract definitions', () => {
  it('health endpoint returns empty 200', () => {
    const route = apiContract.health.getHealth
    expect(route.method).toBe('GET')
    expect(route.path).toBe('/api/v1')
  })

  it('apps endpoint uses AuthHeadersSchema', () => {
    const route = apiContract.apps.listApps
    expect(route.method).toBe('GET')
    expect(route.path).toBe('/api/v1/apps')
    expect(route.headers).toBeDefined()
  })

  it('me endpoint requires authorization header', () => {
    const route = apiContract.me.getMe
    expect(route.method).toBe('GET')
    expect(route.headers).toBeDefined()
  })

  it('locales endpoint has no custom headers', () => {
    const route = apiContract.locales.getLocales
    expect(route.method).toBe('GET')
    expect(route.path).toBe('/api/v1/locales')
    expect(Object.keys((route as Record<string, unknown>).headers ?? {})).toHaveLength(0)
  })

  it('admin/todo endpoint requires admin + JWT', () => {
    const route = apiContract.admin.apps.todo.listAdminTodos
    expect(route.method).toBe('GET')
    expect(route.path).toBe('/api/v1/admin/apps/todo')
    expect(route.responses).toHaveProperty('403')
  })
})
