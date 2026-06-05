import { createAdminClientUntyped } from '@/lib/supabase/admin'

export interface InspirationAdminStats {
  totalRequests: number
  pending: number
  completed: number
  reviewing: number
  hotIdeas: { id: string; title: string; type: string; vote_count: number; comment_count: number }[]
}

export async function getInspirationAdminStats(): Promise<InspirationAdminStats> {
  const db = createAdminClientUntyped()

  // 4 count queries in parallel (fast: count exact with head=true)
  const [{ count: total }, { count: pending }, { count: completed }, { count: reviewing }] = await Promise.all([
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }),
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }).eq('status', 'reviewing'),
  ])

  // Hot ideas: single SQL query with subselects instead of 3 separate queries
  let hotIdeas: InspirationAdminStats['hotIdeas'] = []
  const totalRequests = total ?? 0

  if (totalRequests > 0) {
    const sql = `
      SELECT
        r.id, r.title, r.type,
        COALESCE(v.cnt, 0)::int AS vote_count,
        COALESCE(c.cnt, 0)::int AS comment_count
      FROM inspiration_requests r
      LEFT JOIN (
        SELECT request_id, COUNT(*) AS cnt FROM inspiration_votes GROUP BY request_id
      ) v ON v.request_id = r.id
      LEFT JOIN (
        SELECT request_id, COUNT(*) AS cnt FROM inspiration_comments GROUP BY request_id
      ) c ON c.request_id = r.id
      ORDER BY vote_count DESC, comment_count DESC
      LIMIT 5
    `

    const { data: hotRows } = await db.rpc('exec_sql', { sql })
    if (hotRows) {
      hotIdeas = (hotRows as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        title: r.title as string,
        type: r.type as string,
        vote_count: (r.vote_count as number) ?? 0,
        comment_count: (r.comment_count as number) ?? 0,
      }))
    }
  }

  return {
    totalRequests,
    pending: pending ?? 0,
    completed: completed ?? 0,
    reviewing: reviewing ?? 0,
    hotIdeas,
  }
}
