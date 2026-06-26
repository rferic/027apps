import { useState, useCallback } from 'react'
import { useRouter } from 'expo-router'
import InspirationNativeView, {
  type InspirationRequest,
  type Filters,
} from '../../../../../apps/inspiration/native'
import { mockInspirationRequests } from '@/lib/mock-data'

export default function InspirationListScreen() {
  const router = useRouter()
  const [requests, setRequests] = useState<InspirationRequest[]>(mockInspirationRequests)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>({})

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    // Simulate API call
    setTimeout(() => {
      setRequests([...mockInspirationRequests])
      setRefreshing(false)
    }, 800)
  }, [])

  const handleVote = useCallback((id: string) => {
    setRequests(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              user_has_voted: !r.user_has_voted,
              vote_count: r.user_has_voted ? r.vote_count - 1 : r.vote_count + 1,
            }
          : r
      )
    )
  }, [])

  const handlePressRequest = useCallback(
    (id: string) => {
      router.push(`/(app)/modules/inspiration/${id}`)
    },
    [router]
  )

  const handleFilterChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters)
    setLoading(true)
    setTimeout(() => {
      let filtered = [...mockInspirationRequests]
      if (newFilters.status) {
        filtered = filtered.filter(r => r.status === newFilters.status)
      }
      if (newFilters.type) {
        filtered = filtered.filter(r => r.type === newFilters.type)
      }
      if (newFilters.sort) {
        switch (newFilters.sort) {
          case 'most_supported':
            filtered.sort((a, b) => b.vote_count - a.vote_count)
            break
          case 'most_commented':
            filtered.sort((a, b) => b.comment_count - a.comment_count)
            break
          case 'oldest':
            filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            break
          default:
            filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }
      }
      setRequests(filtered)
      setLoading(false)
    }, 300)
  }, [])

  return (
    <InspirationNativeView
      requests={requests}
      loading={loading}
      refreshing={refreshing}
      activeFilters={filters}
      onRefresh={handleRefresh}
      onVote={handleVote}
      onPressRequest={handlePressRequest}
      onFilterChange={handleFilterChange}
      hasMore={false}
    />
  )
}
