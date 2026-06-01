import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

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
    const logoPath = path.join(process.cwd(), 'apps', slug, 'logo.svg')
    const svg = await fs.readFile(logoPath, 'utf-8')

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch {
    return new NextResponse('Logo not found', { status: 404 })
  }
}
