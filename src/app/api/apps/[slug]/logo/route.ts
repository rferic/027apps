import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { readManifest } from '@/lib/apps/manifest'

const SLUG_RE = /^[a-z0-9-]+$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  if (!SLUG_RE.test(slug)) {
    return new NextResponse('Invalid slug', { status: 400 })
  }

  try {
    const [manifest, svg] = await Promise.all([
      readManifest(slug).catch(() => null),
      fs.readFile(path.join(process.cwd(), 'apps', slug, 'logo.svg'), 'utf-8'),
    ])

    const color = manifest?.primaryColor ?? '#6B7280'
    const injected = svg.replace(/(stroke|fill)="[^"]*"/g, (match, attr) => {
      if (attr === 'fill' && match.includes('none')) return match
      return `${attr}="${color}"`
    })

    return new NextResponse(injected, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Logo not found', { status: 404 })
  }
}
