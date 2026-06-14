export function apiOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status })
}

export function apiError(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>
): Response {
  return Response.json(
    { error: code, message, ...(fields ? { fields } : {}) },
    { status }
  )
}

/**
 * HOF that wraps a route handler to add Server-Timing header.
 * Use at export level:
 *   export const GET = withTiming(async function GET(req) { ... })
 *   export const POST = withTiming(async (req, ctx) => { ... })
 */
export function withTiming<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
  label = 'handler'
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    const start = performance.now()
    try {
      const response = await handler(...args)
      const dur = performance.now() - start
      const body = await response.text()
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: [
          ...response.headers,
          ['Server-Timing', `${label};dur=${dur.toFixed(1)}`],
        ],
      })
    } catch (err) {
      const dur = performance.now() - start
      return new Response(
        JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Server-Timing': `${label};dur=${dur.toFixed(1)}`,
          },
        }
      )
    }
  }
}

export function apiList<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
  baseUrl: string
): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const links: string[] = []
  const totalPages = Math.ceil(total / perPage)

  if (page > 1) links.push(`<${baseUrl}?page=${page - 1}>; rel="prev"`)
  if (page < totalPages) links.push(`<${baseUrl}?page=${page + 1}>; rel="next"`)
  if (links.length > 0) headers.set('Link', links.join(', '))

  return new Response(JSON.stringify(items), { status: 200, headers })
}
