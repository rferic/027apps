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

  // Hot ideas: typed queries instead of exec_sql
  let hotIdeas: InspirationAdminStats['hotIdeas'] = []
  const totalRequests = total ?? 0

  if (totalRequests > 0) {
    const [requestsRes, votesRes, commentsRes] = await Promise.all([
      db.from('inspiration_requests').select('id, title, type'),
      db.from('inspiration_votes').select('request_id'),
      db.from('inspiration_comments').select('request_id'),
    ])

    const requests = requestsRes.data ?? []
    const votes = votesRes.data ?? []
    const comments = commentsRes.data ?? []

    const voteCounts = new Map<string, number>()
    for (const v of votes) {
      const rid = (v as Record<string, unknown>).request_id as string
      voteCounts.set(rid, (voteCounts.get(rid) || 0) + 1)
    }

    const commentCounts = new Map<string, number>()
    for (const c of comments) {
      const rid = (c as Record<string, unknown>).request_id as string
      commentCounts.set(rid, (commentCounts.get(rid) || 0) + 1)
    }

    hotIdeas = requests
      .map((r: Record<string, unknown>) => ({
        id: r.id as string,
        title: r.title as string,
        type: r.type as string,
        vote_count: voteCounts.get(r.id as string) || 0,
        comment_count: commentCounts.get(r.id as string) || 0,
      }))
      .sort((a, b) => b.vote_count - a.vote_count || b.comment_count - a.comment_count)
      .slice(0, 5)
  }

  return {
    totalRequests,
    pending: pending ?? 0,
    completed: completed ?? 0,
    reviewing: reviewing ?? 0,
    hotIdeas,
  }
}
