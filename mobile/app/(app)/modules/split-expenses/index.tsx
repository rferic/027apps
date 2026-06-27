import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from '@/hooks/useTranslation'
import { useSplitExpenses } from '@/hooks/useSplitExpenses'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import type { ExpenseGroup } from '@/lib/api-helpers-types'

const EMOJIS = ['🏠', '🍕', '🚗', '✈️', '🎉', '🍺', '🏖️', '📱', '🎓', '🐶', '🎮', '🎵']
const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN']

export default function SplitExpensesListScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const {
    groups,
    groupsPagination,
    groupsLoading,
    groupsError,
    loadGroups,
    createGroup,
    formatAmount,
  } = useSplitExpenses()

  const [refreshing, setRefreshing] = useState(false)
  const [groupsPage, setGroupsPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEmoji, setNewEmoji] = useState('💰')
  const [newCurrency, setNewCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setGroupsPage(1)
    await loadGroups()
    setRefreshing(false)
  }, [loadGroups])

  const handleCreate = useCallback(async () => {
    const trimmed = newTitle.trim()
    if (!trimmed) {
      setFormError(t('mobile.splitExpenses.validation.groupNameRequired'))
      return
    }
    setFormError('')
    setSaving(true)
    const group = await createGroup({
      title: trimmed,
      emoji: newEmoji,
      currency: newCurrency,
    })
    setSaving(false)
    if (group) {
      setShowCreate(false)
      setNewTitle('')
      setNewEmoji('💰')
      setNewCurrency('EUR')
      router.push(`/(app)/modules/split-expenses/${group.id}`)
    } else {
      setFormError(t('mobile.splitExpenses.createError'))
    }
  }, [newTitle, newEmoji, newCurrency, createGroup, router, t])

  const handleGroupPress = useCallback(
    (groupId: string) => {
      router.push(`/(app)/modules/split-expenses/${groupId}`)
    },
    [router],
  )

  const hasMoreGroups = groupsPagination.page < groupsPagination.total_pages

  const handleLoadMoreGroups = useCallback(async () => {
    if (loadingMore || !hasMoreGroups) return
    setLoadingMore(true)
    const nextPage = groupsPage + 1
    setGroupsPage(nextPage)
    await loadGroups({ page: nextPage })
    setLoadingMore(false)
  }, [loadingMore, hasMoreGroups, groupsPage, loadGroups])

  const resetCreateForm = useCallback(() => {
    setNewTitle('')
    setNewEmoji('💰')
    setNewCurrency('EUR')
    setFormError('')
    setShowCreate(false)
  }, [])

  const renderGroupCard = useCallback(
    ({ item }: { item: ExpenseGroup }) => {
      const balance = item.my_balance ?? 0
      const total = item.total_amount ?? 0
      const pending = item.pending_amount ?? 0
      const ratio = total > 0 ? pending / total : 0
      const balanceColor =
        balance > 0 ? '#10B981' : balance < 0 ? '#DC2626' : '#64748B'

      return (
        <TouchableOpacity
          className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-3"
          onPress={() => handleGroupPress(item.id)}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-3">
            <Text className="text-3xl">{item.emoji || '💰'}</Text>
            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </Text>
                <Text className="text-xs text-slate-400">
                  {item.currency}
                </Text>
              </View>
              <Text className="text-xs text-slate-400 mt-0.5">
                {t('mobile.splitExpenses.members', { count: item.member_count ?? 0 })}
              </Text>
              {balance !== 0 && (
                <Text
                  className="text-sm font-semibold mt-1"
                  style={{ color: balanceColor }}
                >
                  {balance > 0
                    ? `+${formatAmount(balance, item.currency)}`
                    : formatAmount(balance, item.currency)}
                </Text>
              )}
              {balance === 0 && (
                <Text className="text-sm text-slate-400 mt-1">{t('mobile.splitExpenses.balanceEven')}</Text>
              )}
              {total > 0 && (
                <View className="mt-2">
                  <View className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((1 - ratio) * 100)}%`,
                        backgroundColor: '#10B981',
                      }}
                    />
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-[10px] text-slate-400">
                      {formatAmount(total - pending, item.currency)} {t('mobile.splitExpenses.settled')}
                    </Text>
                    <Text
                      className="text-[10px] font-semibold"
                      style={{ color: ratio > 0.5 ? '#DC2626' : '#F59E0B' }}
                    >
                      {Math.round(ratio * 100)}% pending
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <Text className="text-slate-300 dark:text-slate-600 text-lg">
              ›
            </Text>
          </View>
        </TouchableOpacity>
      )
    },
    [handleGroupPress, formatAmount, t],
  )

  const renderEmpty = useCallback(
    () => (
      <EmptyState
        icon="💰"
        title={t('mobile.splitExpenses.noExpenseGroups')}
        message={t('mobile.splitExpenses.noExpenseGroupsDesc')}
        action={{ label: t('mobile.splitExpenses.createGroup'), onPress: () => setShowCreate(true) }}
      />
    ),
    [t],
  )
  if (groupsLoading && groups.length === 0) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950 px-4 pt-4">
        <LoadingSkeleton type="card" count={4} />
      </View>
    )
  }

  if (groupsError && groups.length === 0) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <EmptyState
          icon="⚠️"
          title={t('mobile.splitExpenses.loadError')}
          message={groupsError}
          action={{ label: t('mobile.splitExpenses.retry'), onPress: () => loadGroups() }}
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View>
          <Text className="text-xl font-bold text-slate-900 dark:text-white">
            {t('mobile.splitExpenses.expenses')}
          </Text>
          <Text className="text-xs text-slate-400">
            {groups.length} {t('mobile.splitExpenses.members', { count: groups.length })}
          </Text>
        </View>
        <TouchableOpacity
          className="bg-primary rounded-xl px-4 py-2.5"
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <Text className="text-white text-sm font-semibold">{t('mobile.splitExpenses.createGroup')}</Text>
        </TouchableOpacity>
      </View>

      {/* Group List */}
      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 8,
          flexGrow: 1,
        }}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#9B1C1C" />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#9B1C1C"
          />
        }
        onEndReached={handleLoadMoreGroups}
        onEndReachedThreshold={0.5}
      />

      {/* Create Group Modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={resetCreateForm}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center p-4"
          onPress={resetCreateForm}
        >
          <Pressable
            className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90%]"
            onPress={() => {}}
          >
            <ScrollView
              className="p-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {t('mobile.splitExpenses.createGroup')}
              </Text>

              {/* Title */}
              <View className="mb-4 gap-1.5">
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Group name
                </Text>
                <TextInput
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white bg-white dark:bg-gray-900"
                  value={newTitle}
                  onChangeText={setNewTitle}
                   placeholder={t('mobile.splitExpenses.placeholder.tripName')}
                  placeholderTextColor="#94A3B8"
                  maxLength={100}
                  autoFocus
                />
              </View>

              {/* Emoji Picker */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('mobile.splitExpenses.labels.emoji')}
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {EMOJIS.slice(0, 8).map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      className={`w-11 h-11 items-center justify-center rounded-xl ${
                        newEmoji === emoji
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-slate-100 dark:bg-slate-800 border border-transparent'
                      }`}
                      onPress={() => setNewEmoji(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-xl">{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {EMOJIS.slice(8).map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      className={`w-11 h-11 items-center justify-center rounded-xl ${
                        newEmoji === emoji
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-slate-100 dark:bg-slate-800 border border-transparent'
                      }`}
                      onPress={() => setNewEmoji(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-xl">{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Currency Picker */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('mobile.splitExpenses.labels.currency')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {CURRENCIES.map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      className={`px-4 py-2.5 rounded-xl ${
                        newCurrency === cur
                          ? 'bg-primary'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      onPress={() => setNewCurrency(cur)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          newCurrency === cur
                            ? 'text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cur}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Error */}
              {formError ? (
                <Text className="text-xs text-red-500 mb-3">{formError}</Text>
              ) : null}

              {/* Actions */}
              <View className="flex-row gap-3 justify-end">
                <TouchableOpacity
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                  onPress={resetCreateForm}
                  activeOpacity={0.7}
                >
                  <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('mobile.splitExpenses.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`px-5 py-2.5 rounded-xl ${
                    saving ? 'bg-primary/50' : 'bg-primary'
                  }`}
                  onPress={handleCreate}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-sm font-semibold">
                    {saving ? t('mobile.splitExpenses.creating') : t('mobile.splitExpenses.create')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        onPress={() => setShowCreate(true)}
        activeOpacity={0.8}
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </TouchableOpacity>
    </View>
  )
}
