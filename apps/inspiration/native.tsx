import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestType = 'bug' | 'improvement' | 'new_app' | 'new_app_feature' | 'new_general_functionality' | 'other'
export type RequestStatus = 'pending' | 'reviewing' | 'approved' | 'in_progress' | 'completed' | 'rejected' | 'on_hold' | 'duplicate'
export type SortOption = 'newest' | 'oldest' | 'most_supported' | 'most_commented'

export interface InspirationRequest {
  id: string
  title: string
  description: string
  type: RequestType
  status: RequestStatus
  app_slug: string | null
  created_at: string
  vote_count: number
  comment_count: number
  user_has_voted: boolean
}

export interface Filters {
  status?: RequestStatus
  type?: RequestType
  sort?: SortOption
}

export interface Comment {
  id: string
  request_id: string
  user_id: string
  body: string
  created_at: string
  user?: { display_name: string | null; avatar_url: string | null } | null
}

export interface CommentPagination {
  page: number
  total_pages: number
}

interface Props {
  requests: InspirationRequest[]
  onRefresh: () => void
  onVote: (id: string) => void
  onPressRequest: (id: string) => void
  onFilterChange: (filters: Filters) => void
  onLoadMore?: () => void
  loading: boolean
  refreshing: boolean
  hasMore?: boolean
  activeFilters?: Filters
  // Comments (detail view)
  comments?: Comment[]
  onLoadComments?: (requestId: string, page: number) => void
  commentsLoading?: boolean
  commentsPagination?: CommentPagination
  selectedRequest?: InspirationRequest | null
  onCloseDetail?: () => void
}

// ─── Config ───────────────────────────────────────────────────────────────────

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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_supported', label: 'Most voted' },
  { value: 'most_commented', label: 'Most commented' },
]

const TYPE_OPTIONS: (RequestType | undefined)[] = [
  undefined, 'bug', 'improvement', 'new_app', 'new_app_feature', 'new_general_functionality', 'other',
]

const STATUS_OPTIONS: (RequestStatus | undefined)[] = [
  undefined, 'pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected', 'on_hold', 'duplicate',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function filterLabel(value: string | undefined, options: (string | undefined)[], config: Record<string, { label: string }>): string {
  if (!value) return 'All'
  return config[value]?.label ?? value
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InspirationNativeView({
  requests,
  onRefresh,
  onVote,
  onPressRequest,
  onFilterChange,
  onLoadMore,
  loading,
  refreshing,
  hasMore = false,
  activeFilters = {},
  comments,
  onLoadComments,
  commentsLoading = false,
  commentsPagination,
  selectedRequest,
  onCloseDetail,
}: Props) {
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [detailCommentsPage, setDetailCommentsPage] = useState(1)
  const [pendingFilters, setPendingFilters] = useState<Filters>(activeFilters)

  const openFilterModal = useCallback(() => {
    setPendingFilters(activeFilters)
    setFilterModalVisible(true)
  }, [activeFilters])

  const applyFilters = useCallback(() => {
    onFilterChange(pendingFilters)
    setFilterModalVisible(false)
  }, [pendingFilters, onFilterChange])

  const handleLoadComments = useCallback(() => {
    if (!selectedRequest || !onLoadComments) return
    const nextPage = detailCommentsPage + 1
    setDetailCommentsPage(nextPage)
    onLoadComments(selectedRequest.id, nextPage)
  }, [selectedRequest, onLoadComments, detailCommentsPage])

  // Reset comments page when detail changes
  const handleOpenDetail = useCallback((id: string) => {
    setDetailCommentsPage(1)
    onPressRequest(id)
  }, [onPressRequest])

  const activeCount = activeFilters.status || activeFilters.type || activeFilters.sort ? 1 : 0

  // ── Loading state ──
  if (loading && requests.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    )
  }

  // ── Main render ──
  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterPill} onPress={openFilterModal}>
          <Text style={styles.filterPillText}>Filters</Text>
          {activeCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersScroll}>
          {activeFilters.status && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>
                {STATUS_CONFIG[activeFilters.status]?.label ?? activeFilters.status}
              </Text>
            </View>
          )}
          {activeFilters.type && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>
                {TYPE_CONFIG[activeFilters.type]?.label ?? activeFilters.type}
              </Text>
            </View>
          )}
          {activeFilters.sort && (
            <View style={[styles.activeFilterChip, styles.activeSortChip]}>
              <Text style={styles.activeFilterChipText}>
                {SORT_OPTIONS.find(s => s.value === activeFilters.sort)?.label ?? activeFilters.sort}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
        onEndReached={hasMore ? onLoadMore : undefined}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#F59E0B" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No ideas yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const typeConfig = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other
          const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleOpenDetail(item.id)}
              activeOpacity={0.7}
            >
              {/* Top row: type + status badges */}
              <View style={styles.cardTop}>
                <View style={[styles.badge, { backgroundColor: typeConfig.color + '18' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: typeConfig.color }]} />
                  <Text style={[styles.badgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusConfig.color + '18' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: statusConfig.color }]} />
                  <Text style={[styles.badgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

              {/* Description preview */}
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}

              {/* Bottom row: vote, comments, time */}
              <View style={styles.cardBottom}>
                <TouchableOpacity
                  style={[styles.voteButton, item.user_has_voted && styles.voteButtonActive]}
                  onPress={() => onVote(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.voteIcon, item.user_has_voted && styles.voteIconActive]}>
                    {item.user_has_voted ? '♥' : '♡'}
                  </Text>
                  <Text style={[styles.voteCount, item.user_has_voted && styles.voteCountActive]}>
                    {item.vote_count}
                  </Text>
                </TouchableOpacity>

                <View style={styles.commentCount}>
                  <Text style={styles.commentIcon}>💬</Text>
                  <Text style={styles.commentCountText}>{item.comment_count}</Text>
                </View>

                <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      {/* ── Filter Modal ── */}
      <Modal visible={filterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Type */}
              <Text style={styles.filterSectionLabel}>Type</Text>
              <View style={styles.filterOptions}>
                {TYPE_OPTIONS.map(type => (
                  <TouchableOpacity
                    key={type ?? 'all'}
                    style={[
                      styles.filterOption,
                      pendingFilters.type === type && styles.filterOptionActive,
                      type === undefined && pendingFilters.type === undefined && styles.filterOptionActive,
                    ]}
                    onPress={() => setPendingFilters(prev => ({ ...prev, type }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      (pendingFilters.type === type || (type === undefined && pendingFilters.type === undefined))
                        && styles.filterOptionTextActive,
                    ]}>
                      {filterLabel(type, TYPE_OPTIONS as string[], TYPE_CONFIG)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Status */}
              <Text style={styles.filterSectionLabel}>Status</Text>
              <View style={styles.filterOptions}>
                {STATUS_OPTIONS.map(status => (
                  <TouchableOpacity
                    key={status ?? 'all'}
                    style={[
                      styles.filterOption,
                      pendingFilters.status === status && styles.filterOptionActive,
                      status === undefined && pendingFilters.status === undefined && styles.filterOptionActive,
                    ]}
                    onPress={() => setPendingFilters(prev => ({ ...prev, status }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      (pendingFilters.status === status || (status === undefined && pendingFilters.status === undefined))
                        && styles.filterOptionTextActive,
                    ]}>
                      {filterLabel(status, STATUS_OPTIONS as string[], STATUS_CONFIG)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sort */}
              <Text style={styles.filterSectionLabel}>Sort</Text>
              <View style={styles.filterOptions}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.filterOption,
                      pendingFilters.sort === opt.value && styles.filterOptionActive,
                    ]}
                    onPress={() => setPendingFilters(prev => ({
                      ...prev,
                      sort: prev.sort === opt.value ? undefined : opt.value,
                    }))}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      pendingFilters.sort === opt.value && styles.filterOptionTextActive,
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => onFilterChange({})}
              >
                <Text style={styles.clearButtonText}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      {selectedRequest && (
        <Modal visible={!!selectedRequest} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.detailPanel}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Idea Detail</Text>
                <TouchableOpacity onPress={onCloseDetail}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detailBody}>
                {/* Badges */}
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: (TYPE_CONFIG[selectedRequest.type] ?? TYPE_CONFIG.other).color + '18' }]}>
                    <View style={[styles.badgeDot, { backgroundColor: (TYPE_CONFIG[selectedRequest.type] ?? TYPE_CONFIG.other).color }]} />
                    <Text style={[styles.badgeText, { color: (TYPE_CONFIG[selectedRequest.type] ?? TYPE_CONFIG.other).color }]}>
                      {(TYPE_CONFIG[selectedRequest.type] ?? TYPE_CONFIG.other).label}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: (STATUS_CONFIG[selectedRequest.status] ?? STATUS_CONFIG.pending).color + '18' }]}>
                    <View style={[styles.badgeDot, { backgroundColor: (STATUS_CONFIG[selectedRequest.status] ?? STATUS_CONFIG.pending).color }]} />
                    <Text style={[styles.badgeText, { color: (STATUS_CONFIG[selectedRequest.status] ?? STATUS_CONFIG.pending).color }]}>
                      {(STATUS_CONFIG[selectedRequest.status] ?? STATUS_CONFIG.pending).label}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.detailTitle}>{selectedRequest.title}</Text>

                {/* Description */}
                {selectedRequest.description ? (
                  <Text style={styles.detailDescription}>{selectedRequest.description}</Text>
                ) : null}

                {/* Vote button */}
                <TouchableOpacity
                  style={[styles.detailVoteButton, selectedRequest.user_has_voted && styles.detailVoteButtonActive]}
                  onPress={() => onVote(selectedRequest.id)}
                >
                  <Text style={styles.detailVoteIcon}>
                    {selectedRequest.user_has_voted ? '♥' : '♡'}
                  </Text>
                  <Text style={styles.detailVoteText}>
                    {selectedRequest.user_has_voted ? 'Supported' : 'Support this idea'}
                  </Text>
                  <Text style={styles.detailVoteCount}>
                    {selectedRequest.vote_count} votes
                  </Text>
                </TouchableOpacity>

                {/* Meta */}
                <Text style={styles.detailMeta}>
                  {formatTimeAgo(selectedRequest.created_at)}
                </Text>

                {/* Comments section */}
                <Text style={styles.commentsHeader}>
                  Comments ({selectedRequest.comment_count})
                </Text>

                {commentsLoading && (!comments || comments.length === 0) ? (
                  <ActivityIndicator size="small" color="#F59E0B" style={{ marginTop: 16 }} />
                ) : comments && comments.length > 0 ? (
                  <View style={styles.commentsList}>
                    {comments.map(comment => (
                      <View key={comment.id} style={styles.commentItem}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>
                            {(comment.user?.display_name ?? '?')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.commentContent}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentAuthor}>
                              {comment.user?.display_name ?? 'Unknown'}
                            </Text>
                            <Text style={styles.commentTime}>
                              {formatTimeAgo(comment.created_at)}
                            </Text>
                          </View>
                          <Text style={styles.commentBody}>{comment.body}</Text>
                        </View>
                      </View>
                    ))}

                    {commentsPagination && commentsPagination.page < commentsPagination.total_pages && (
                      <TouchableOpacity
                        style={styles.loadMoreComments}
                        onPress={handleLoadComments}
                        disabled={commentsLoading}
                      >
                        {commentsLoading ? (
                          <ActivityIndicator size="small" color="#F59E0B" />
                        ) : (
                          <Text style={styles.loadMoreCommentsText}>Load more comments</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <Text style={styles.noComments}>No comments yet</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Filter bar
  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  filterPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  filterBadge: {
    backgroundColor: '#F59E0B', borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6, paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  activeFiltersScroll: { flex: 1 },
  activeFilterChip: {
    backgroundColor: '#F59E0B15', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6,
  },
  activeSortChip: { backgroundColor: '#3B82F615' },
  activeFilterChipText: { fontSize: 12, fontWeight: '500', color: '#F59E0B' },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    marginHorizontal: 16, marginTop: 10, padding: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardTop: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 4, lineHeight: 20 },
  cardDesc: { fontSize: 13, color: '#64748B', marginBottom: 10, lineHeight: 18 },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F8FAFC',
  },

  // Vote button
  voteButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  voteButtonActive: { backgroundColor: '#FEE2E2' },
  voteIcon: { fontSize: 14, color: '#94A3B8' },
  voteIconActive: { color: '#EF4444' },
  voteCount: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  voteCountActive: { color: '#EF4444' },

  // Comment count
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentIcon: { fontSize: 12 },
  commentCountText: { fontSize: 13, fontWeight: '500', color: '#64748B' },

  // Time
  timeAgo: { fontSize: 12, color: '#94A3B8', marginLeft: 'auto' },

  // Footer / empty
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94A3B8' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '80%', paddingBottom: 34,
  },
  detailPanel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%', paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  modalClose: { fontSize: 20, color: '#94A3B8', padding: 4 },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },
  modalFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },

  // Filter options
  filterSectionLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 16, marginBottom: 8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterOption: {
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  filterOptionActive: { backgroundColor: '#F59E0B' },
  filterOptionText: { fontSize: 13, fontWeight: '500', color: '#475569' },
  filterOptionTextActive: { color: '#FFFFFF' },

  // Filter actions
  clearButton: { paddingVertical: 10, paddingHorizontal: 16 },
  clearButtonText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  applyButton: {
    backgroundColor: '#F59E0B', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  applyButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Detail
  detailBody: { padding: 20 },
  detailTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginTop: 12, marginBottom: 8 },
  detailDescription: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 16 },
  detailVoteButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12,
  },
  detailVoteButtonActive: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  detailVoteIcon: { fontSize: 20 },
  detailVoteText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  detailVoteCount: { fontSize: 13, color: '#94A3B8' },
  detailMeta: { fontSize: 13, color: '#94A3B8', marginBottom: 20 },

  // Comments
  commentsHeader: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  commentsList: { gap: 12 },
  commentItem: { flexDirection: 'row', gap: 10 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  commentTime: { fontSize: 12, color: '#94A3B8' },
  commentBody: { fontSize: 14, color: '#334155', lineHeight: 20 },
  loadMoreComments: {
    alignItems: 'center', paddingVertical: 12,
    backgroundColor: '#F8FAFC', borderRadius: 10, marginTop: 4,
  },
  loadMoreCommentsText: { fontSize: 13, fontWeight: '600', color: '#F59E0B' },
  noComments: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 20 },
})
