import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import type { TestResult } from '../../../../../../../../apps/inspiration/github-actions'
import { runIntegrationTests } from '../../../../../../../../apps/inspiration/github-actions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const results: TestResult[] = await runIntegrationTests()
  const allOk = results.every((r: TestResult) => r.ok)

  return apiOk({
    summary: allOk ? 'All tests passed' : 'Some tests failed',
    total: results.length,
    passed: results.filter((r: TestResult) => r.ok).length,
    failed: results.filter((r: TestResult) => !r.ok).length,
    results,
  })
}
