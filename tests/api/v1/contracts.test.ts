import { describe, it, expect } from 'vitest'
import { apiContract } from '@/contracts'

describe('OpenAPI generation', () => {
  it('generates valid spec with all endpoints', async () => {
    const { generateOpenApi } = await import('@ts-rest/open-api')

    const doc = generateOpenApi(apiContract, {
      info: { title: 'Test', version: '1.0.0' },
    })

    // All 5 endpoints present
    expect(doc.paths).toHaveProperty('/api/v1')
    expect(doc.paths).toHaveProperty('/api/v1/apps')
    expect(doc.paths).toHaveProperty('/api/v1/me')
    expect(doc.paths).toHaveProperty('/api/v1/locales')
    expect(doc.paths).toHaveProperty('/api/v1/admin/apps/todo')
  })

  it('health endpoint returns ok', () => {
    const route = apiContract.health.getHealth
    expect(route.method).toBe('GET')
    expect(route.path).toBe('/api/v1')
  })

  it('me endpoint requires authorization header', () => {
    const route = apiContract.me.getMe
    expect(route.method).toBe('GET')
    expect(route.headers).toBeDefined()
  })
})
