import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  TextInput, FlatList, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { InspirationRequest, Comment } from '../../../../../apps/inspiration/native'
import { mockInspirationRequests, getMockCommentsForRequest } from '@/lib/mock-data'
import { VoteButton } from '@/components/VoteButton'
import { CommentItem } from '@/components/CommentItem'

const COMMENTS_PER_PAGE = 10

export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [request, setRequest] = useState<InspirationRequest | null>(() =>
    mockInspirationRequests.find(r => r.id === id) ?? null
  )
  const [comments, setComments] = useState<Comment[]>(() =>
    id ? getMockCommentsForRequest(id) : []
  )
  const [commentText, setCommentText] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [submittingVote, setSubmittingVote] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentsPage, setCommentsPage] = useState(1)
  const [loadingMoreComments, setLoadingMoreComments] = useState(false)

  // Track total comments from mock to determine if there are more
  const totalMockComments = id ? getMockCommentsForRequest(id) : []
  const hasMoreComments = comments.length < totalMockComments.length

  const handleVote = useCallback(() => {
    if (!request) return
    setSubmittingVote(true)
    setTimeout(() => {
      setRequest(prev => {
        if (!prev) return prev
        return {
          ...prev,
          user_has_voted: !prev.user_has_voted,
          vote_count: prev.user_has_voted ? prev.vote_count - 1 : prev.vote_count + 1,
        }
      })
      setSubmittingVote(false)
    }, 200)
  }, [request])

  const handleAddComment = useCallback(() => {
    const body = commentText.trim()
    if (!body || !request) return

    setSubmittingComment(true)
    // Simulate API call
    setTimeout(() => {
      const newComment: Comment = {
        id: `c-new-${Date.now()}`,
        request_id: request.id,
        user_id: 'me',
        body,
        created_at: new Date().toISOString(),
        user: { display_name: 'You', avatar_url: null },
      }
      setComments(prev => [newComment, ...prev])
      setRequest(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev)
      setCommentText('')
      setSubmittingComment(false)
    }, 200)
  }, [commentText, request])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => {
      setRequest(mockInspirationRequests.find(r => r.id === id) ?? null)
      if (id) {
        setComments(getMockCommentsForRequest(id))
        setCommentsPage(1)
      }
      setRefreshing(false)
    }, 800)
  }, [id])

  const handleLoadMoreComments = useCallback(() => {
    if (loadingMoreComments || !hasMoreComments) return
    setLoadingMoreComments(true)
    setTimeout(() => {
      setCommentsPage(prev => prev + 1)
      setComments(prev => {
        // Simulate loading more from mock data
        return totalMockComments.slice(0, comments.length + COMMENTS_PER_PAGE)
      })
      setLoadingMoreComments(false)
    }, 400)
  }, [loadingMoreComments, hasMoreComments, comments.length, totalMockComments])

  if (!request) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-slate-400">Idea not found</Text>
      </View>
    )
  }

  const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    bug: { label: 'Bug', color: '#EF4444' },
    improvement: { label: 'Improvement', color: '#F59E0B' },
    new_app: { label: 'New App', color: '#8B5CF6' },
    new_app_feature: { label: 'Feature', color: '#3B82F6' },
    new_general_functionality: { label: 'Functionality', color: '#10B981' },
    other: { label: 'Other', color: '#6B7280' },
  }
  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: '#F59E0B' },
    reviewing: { label: 'Reviewing', color: '#3B82F6' },
    approved: { label: 'Approved', color: '#10B981' },
    in_progress: { label: 'In Progress', color: '#F97316' },
    completed: { label: 'Completed', color: '#7C3AED' },
    rejected: { label: 'Rejected', color: '#EF4444' },
    on_hold: { label: 'On Hold', color: '#6B7280' },
    duplicate: { label: 'Duplicate', color: '#8B5CF6' },
  }
  const typeConfig = TYPE_CONFIG[request.type] ?? TYPE_CONFIG.other
  const statusConfig = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.pending

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F59E0B" />
        }
      >
        {/* Badges */}
        <View className="flex-row gap-2 px-4 pt-4 pb-2">
          <View
            className="flex-row items-center rounded-md px-2.5 py-1"
            style={{ backgroundColor: typeConfig.color + '18' }}
          >
            <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: typeConfig.color }} />
            <Text className="text-xs font-semibold" style={{ color: typeConfig.color }}>{typeConfig.label}</Text>
          </View>
          <View
            className="flex-row items-center rounded-md px-2.5 py-1"
            style={{ backgroundColor: statusConfig.color + '18' }}
          >
            <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: statusConfig.color }} />
            <Text className="text-xs font-semibold" style={{ color: statusConfig.color }}>{statusConfig.label}</Text>
          </View>
          {request.app_slug && (
            <View className="flex-row items-center rounded-md px-2.5 py-1 bg-slate-100">
              <Text className="text-xs font-medium text-slate-500">{request.app_slug}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-slate-900 px-4 mt-2">{request.title}</Text>

        {/* Description */}
        {request.description ? (
          <Text className="text-base text-slate-600 leading-6 px-4 mt-3">{request.description}</Text>
        ) : null}

        {/* Vote row */}
        <View className="flex-row items-center px-4 mt-5 mb-1">
          <VoteButton
            count={request.vote_count}
            hasVoted={request.user_has_voted}
            onPress={handleVote}
            loading={submittingVote}
          />
          <Text className="text-xs text-slate-400 ml-3">
            Created {new Date(request.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </Text>
        </View>

        {/* Divider */}
        <View className="h-px bg-slate-100 mt-4" />

        {/* Comments header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-base font-bold text-slate-800">
            Comments ({request.comment_count})
          </Text>
        </View>

        {/* Comment form */}
        <View className="px-4 pb-3">
          <View className="flex-row items-end gap-2">
            <TextInput
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Add a comment..."
              placeholderTextColor="#94A3B8"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleAddComment}
              disabled={commentText.trim().length === 0 || submittingComment}
              className={`rounded-lg px-3.5 py-2.5 ${
                commentText.trim().length > 0 && !submittingComment
                  ? 'bg-amber-500'
                  : 'bg-slate-200'
              }`}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className={`text-sm font-semibold ${
                  commentText.trim().length > 0 ? 'text-white' : 'text-slate-400'
                }`}>
                  Send
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments list */}
        {comments.length > 0 ? (
          <View className="px-4">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                id={comment.id}
                author={comment.user?.display_name ?? 'Unknown'}
                body={comment.body}
                createdAt={comment.created_at}
                avatarUrl={comment.user?.avatar_url ?? null}
              />
            ))}
            {hasMoreComments && (
              <TouchableOpacity
                onPress={handleLoadMoreComments}
                disabled={loadingMoreComments}
                className="items-center py-3 my-2 bg-slate-50 rounded-lg"
              >
                {loadingMoreComments ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Text className="text-sm font-semibold text-amber-500">Load more comments</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="px-4 py-10 items-center">
            <Text className="text-sm text-slate-400">No comments yet</Text>
          </View>
        )}

        {/* Bottom padding for FAB */}
        <View className="h-20" />
      </ScrollView>

      {/* FAB: Create new idea */}
      <TouchableOpacity
        className="bg-red-800 rounded-full w-14 h-14 items-center justify-center shadow-lg absolute bottom-6 right-6"
        onPress={() => router.push('/(app)/modules/inspiration/create')}
        activeOpacity={0.8}
      >
        <Text className="text-white text-2xl font-light">+</Text>
      </TouchableOpacity>
    </View>
  )
}
