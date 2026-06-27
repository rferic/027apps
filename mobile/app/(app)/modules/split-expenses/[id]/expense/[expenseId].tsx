import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import { useTranslation } from '@/hooks/useTranslation'
import { useSplitExpenses } from '@/hooks/useSplitExpenses'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { DsAvatar } from '@/components/ds/DsAvatar'
import { DsBadge } from '@/components/ds/DsBadge'
import { DsConfirmModal } from '@/components/ds/DsConfirmModal'
import type { Expense, Tag } from '@/lib/api-helpers-types'

export default function ExpenseDetailScreen() {
  const { t } = useTranslation()
  const { id: groupId, expenseId } = useLocalSearchParams<{
    id: string
    expenseId: string
  }>()
  const router = useRouter()
  const hook = useSplitExpenses(groupId)
  const {
    expenses,
    expensesLoading,
    tags,
    currentGroup,
    deleteExpense,
    formatAmount,
    recordPayment,
  } = hook

  const currency = currentGroup?.currency || 'EUR'

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [settlingShare, setSettlingShare] = useState<string | null>(null)

  const expense = expenseId
    ? expenses.find((e: Expense) => e.id === expenseId)
    : null

  const tag: Tag | undefined = expense?.tag_id
    ? tags.find((t: Tag) => t.id === expense.tag_id)
    : undefined

  const handleDelete = useCallback(async () => {
    if (!expense) return
    setShowDeleteConfirm(false)
    const ok = await deleteExpense(expense.id)
    if (ok) {
      router.back()
    }
  }, [expense, deleteExpense, router])

  const handleSettleShare = useCallback(
    async (share: { user_id: string; amount: number }) => {
      if (!expense || !groupId) return
      setSettlingShare(share.user_id)
      await recordPayment({
        from_user: share.user_id,
        to_user: expense.paid_by,
        amount: share.amount,
        note: `Settlement for "${expense.title}"`,
      })
      setSettlingShare(null)
    },
    [expense, groupId, recordPayment],
  )

  const handleEdit = useCallback(() => {
    if (!expense || !groupId) return
    router.push({
      pathname: `/(app)/modules/split-expenses/${groupId}/expense/new`,
      params: { expenseId: expense.id },
    })
  }, [expense, groupId, router])

  if (expensesLoading && !expense) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950 px-4 pt-4">
        <Stack.Screen options={{ title: t('mobile.splitExpenses.expenses') }} />
        <LoadingSkeleton type="detail" />
      </View>
    )
  }

  if (!expense) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <Stack.Screen options={{ title: t('mobile.splitExpenses.expenses') }} />
        <EmptyState
          icon="🔍"
          title={t('mobile.splitExpenses.loadError')}
          message="This expense may have been deleted."
          action={{ label: t('mobile.splitExpenses.goBack'), onPress: () => router.back() }}
        />
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Stack.Screen options={{ title: t('mobile.splitExpenses.expenses') }} />

      {/* Header */}
      <View className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-4">
        <Text className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          {expense.title}
        </Text>
        <Text className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          {formatAmount(expense.amount, currency)}
        </Text>

        {/* Paid by */}
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-xs text-slate-400">{t('mobile.splitExpenses.expensePaidBy')}</Text>
          <DsAvatar
            name={expense.paid_by_profile?.display_name || '?'}
            size="sm"
          />
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {expense.paid_by_profile?.display_name || t('mobile.splitExpenses.labels.unknown')}
          </Text>
        </View>

        {/* Date */}
        <View className="flex-row items-center gap-1 mb-2">
          <Text className="text-xs text-slate-400">
            {new Date(expense.created_at).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Tag */}
        {tag && (
          <View className="flex-row items-center gap-2 mt-1">
            <View
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <DsBadge label={tag.name} variant="primary" />
          </View>
        )}
      </View>

      {/* Shares */}
      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Shares ({expense.shares.length})
      </Text>
      {expense.shares.map((share) => {
        const isPayer = share.user_id === expense.paid_by
        const isSettling = settlingShare === share.user_id

        return (
          <View
            key={share.id}
            className="bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-slate-800 p-3 mb-2"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1">
                <DsAvatar
                  name={share.user_profile?.display_name || '?'}
                  size="sm"
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-900 dark:text-white">
                    {share.user_profile?.display_name || t('mobile.splitExpenses.labels.user')}
                    {isPayer && (
                      <Text className="text-xs text-emerald-500 font-normal">
                        {' '}
                        ({t('mobile.splitExpenses.settled')})
                      </Text>
                    )}
                  </Text>
                  <Text className="text-xs text-slate-400">
                    {isPayer ? t('mobile.splitExpenses.settled') : t('mobile.splitExpenses.balanceOwe')}{' '}
                    {formatAmount(share.amount, currency)}
                  </Text>
                </View>
              </View>
              {!isPayer && (
                <TouchableOpacity
                  className={`rounded-lg px-3 py-2 ${
                    isSettling ? 'bg-emerald-400' : 'bg-emerald-500'
                  }`}
                  onPress={() => handleSettleShare(share)}
                  disabled={isSettling}
                  activeOpacity={0.7}
                >
                  {isSettling ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-xs font-semibold">
                      {t('mobile.splitExpenses.settleAll')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      })}

      {/* Actions */}
      <View className="flex-row gap-3 mt-6">
        <TouchableOpacity
          className="flex-1 rounded-xl py-3.5 items-center border border-slate-200 dark:border-slate-700"
          onPress={handleEdit}
          activeOpacity={0.7}
        >
          <Text className="text-slate-700 dark:text-slate-300 text-sm font-semibold">
            {t('mobile.splitExpenses.edit')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 rounded-xl py-3.5 items-center bg-red-600"
          onPress={() => setShowDeleteConfirm(true)}
          activeOpacity={0.8}
        >
          <Text className="text-white text-sm font-semibold">{t('mobile.splitExpenses.delete')}</Text>
        </TouchableOpacity>
      </View>

      {/* Delete confirm */}
      <DsConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('mobile.splitExpenses.expenseDelete')}
        message={t('mobile.splitExpenses.expenseDeleteConfirm')}
        confirmLabel={t('mobile.splitExpenses.delete')}
        variant="danger"
        onConfirm={handleDelete}
      />
    </ScrollView>
  )
}
