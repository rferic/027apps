import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

describe('getClientIp', () => {
  it('extracts last IP from x-forwarded-for chain', async () => {
    const { getClientIp } = await import('@/lib/rate-limit')
    expect(getClientIp('1.2.3.4')).toBe('1.2.3.4')
    expect(getClientIp('fake, 1.2.3.4')).toBe('1.2.3.4')
    expect(getClientIp('fake1, fake2, 1.2.3.4')).toBe('1.2.3.4')
    expect(getClientIp(null)).toBe('unknown')
    expect(getClientIp('')).toBe('unknown')
  })
})

describe('GET /api/v1', () => {
  it('returns version and status with cache headers', async () => {
    const { GET } = await import('@/app/api/v1/route')
    const req = new NextRequest('https://localhost/api/v1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, s-maxage=60')
    const body = await res.json()
    expect(body).toEqual({ version: 'v1', status: 'ok' })
  })

  it('rate limits after 120 requests from same IP', async () => {
    const { GET } = await import('@/app/api/v1/route')
    const req = new NextRequest('https://localhost/api/v1', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    for (let i = 0; i < 120; i++) {
      const res = await GET(req)
      expect(res.status).toBe(200)
    }
    const blocked = await GET(req)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe('60')
  })

  it('different IPs get independent limits', async () => {
    const { GET } = await import('@/app/api/v1/route')
    const req1 = new NextRequest('https://localhost/api/v1', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })
    for (let i = 0; i < 120; i++) {
      await GET(req1)
    }
    const blocked = await GET(req1)
    expect(blocked.status).toBe(429)

    const req2 = new NextRequest('https://localhost/api/v1', {
      headers: { 'x-forwarded-for': '10.0.0.2' },
    })
    const allowed = await GET(req2)
    expect(allowed.status).toBe(200)
  })

  it('collapses spoofed IPs into same bucket (uses last value)', async () => {
    const { GET } = await import('@/app/api/v1/route')
    // Vercel format: the real client IP is appended last.
    // If an attacker sends forged values, Vercel appends the real IP.
    // E.g. attacker sends "spoofed1" → Vercel produces "spoofed1, real-ip"
    // We take the last value → "real-ip" → same bucket regardless of forged values.
    const realIp = '5.5.5.5'

    // Burn most of the quota with one forged value
    const reqA = new NextRequest('https://localhost/api/v1', {
      headers: { 'x-forwarded-for': `spoofedA, ${realIp}` },
    })
    for (let i = 0; i < 60; i++) {
      await GET(reqA)
    }

    // Continue with a different forged value — should still count toward same bucket
    const reqB = new NextRequest('https://localhost/api/v1', {
      headers: { 'x-forwarded-for': `spoofedB, ${realIp}` },
    })
    for (let i = 0; i < 59; i++) {
      const res = await GET(reqB)
      expect(res.status).toBe(200)
    }

    // 60 + 59 = 119, next one is 120th → still allowed
    const stillOk = await GET(reqB)
    expect(stillOk.status).toBe(200)

    // 121st → blocked
    const blocked = await GET(reqB)
    expect(blocked.status).toBe(429)
  })
})
