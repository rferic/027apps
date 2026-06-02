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

  const [{ count: total }, { count: pending }, { count: completed }, { count: reviewing }] = await Promise.all([
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }),
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    db.from('inspiration_requests').select('*', { count: 'exact', head: true }).eq('status', 'reviewing'),
  ])

  const { data: allRequests } = await db.from('inspiration_requests').select('id, title, type')

  let hotIdeas: InspirationAdminStats['hotIdeas'] = []
  if (allRequests && allRequests.length > 0) {
    const allIds = allRequests.map(r => r.id)
    const [{ data: votes }, { data: comments }] = await Promise.all([
      db.from('inspiration_votes').select('request_id'),
      db.from('inspiration_comments').select('request_id'),
    ])

    const voteCounts = new Map<string, number>()
    votes?.forEach(v => voteCounts.set(v.request_id, (voteCounts.get(v.request_id) || 0) + 1))

    const commentCounts = new Map<string, number>()
    comments?.forEach(c => commentCounts.set(c.request_id, (commentCounts.get(c.request_id) || 0) + 1))

    hotIdeas = allRequests
      .map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        vote_count: voteCounts.get(r.id) || 0,
        comment_count: commentCounts.get(r.id) || 0,
      }))
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 5)
  }

  return {
    totalRequests: total ?? 0,
    pending: pending ?? 0,
    completed: completed ?? 0,
    reviewing: reviewing ?? 0,
    hotIdeas,
  }
}
