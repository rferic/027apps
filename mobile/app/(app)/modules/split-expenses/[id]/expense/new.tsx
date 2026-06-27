import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import { useTranslation } from '@/hooks/useTranslation'
import { useSplitExpenses } from '@/hooks/useSplitExpenses'
import { DsInput } from '@/components/ds/DsInput'
import { DsAvatar } from '@/components/ds/DsAvatar'
import type { Member, Tag, Expense } from '@/lib/api-helpers-types'

export default function CreateExpenseScreen() {
  const { t } = useTranslation()
  const { id: groupId, expenseId } = useLocalSearchParams<{
    id: string
    expenseId?: string
  }>()
  const router = useRouter()
  const hook = useSplitExpenses(groupId)
  const { members, tags, expenses, expensesLoading, createExpense, updateExpense, fetchExpense } = hook

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [tagId, setTagId] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [showPaidByPicker, setShowPaidByPicker] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)

  const isEditing = !!expenseId

  // Populate form fields from an expense object
  const populateForm = useCallback((exp: Expense) => {
    setTitle(exp.title)
    setAmount(exp.amount.toString())
    setPaidBy(exp.paid_by)
    setTagId(exp.tag_id || '')
    setParticipantIds(exp.shares.map((s) => s.user_id))
    setCustomAmounts(
      Object.fromEntries(
        exp.shares.map((s) => [s.user_id, s.amount.toString()]),
      ),
    )
  }, [])

  // Load existing expense data into form when editing
  useEffect(() => {
    if (!expenseId || loaded) return
    const existing = expenses.find((e) => e.id === expenseId)
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      populateForm(existing)
      setLoaded(true)
    } else if (!expensesLoading && expenses.length === 0) {
      // Expenses haven't loaded yet — fetch individually by ID
      fetchExpense(expenseId).then((exp) => {
        if (exp) populateForm(exp)
        setLoaded(true)
      })
    }
  }, [expenseId, expenses, expensesLoading, loaded, populateForm, fetchExpense])

  const activeMembers = members

  const handleToggleParticipant = useCallback(
    (userId: string) => {
      setParticipantIds((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId],
      )
    },
    [],
  )

  const handleSave = useCallback(async () => {
    setFormError('')
    const trimmedTitle = title.trim()
    const numAmount = parseFloat(amount)

    if (!trimmedTitle) {
      setFormError('Title is required')
      return
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setFormError('Valid amount is required')
      return
    }
    if (!paidBy) {
      setFormError('Select who paid')
      return
    }
    if (participantIds.length === 0) {
      setFormError('Select at least one participant')
      return
    }

    setSaving(true)
    try {
      if (isEditing && expenseId) {
        await updateExpense(expenseId, {
          title: trimmedTitle,
          amount: numAmount,
          paid_by: paidBy,
          tag_id: tagId || undefined,
          participant_ids: participantIds,
        })
      } else {
        await createExpense({
          title: trimmedTitle,
          amount: numAmount,
          paid_by: paidBy,
          tag_id: tagId || undefined,
          participant_ids: participantIds,
        })
      }
      router.back()
    } catch {
      setFormError('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }, [
    title,
    amount,
    paidBy,
    tagId,
    participantIds,
    isEditing,
    expenseId,
    createExpense,
    updateExpense,
    router,
  ])

  const numAmount = parseFloat(amount) || 0
  const totalCents = Math.round(numAmount * 100)
  const shareCents =
    participantIds.length > 0
      ? Math.floor(totalCents / participantIds.length)
      : 0
  const equalShare =
    participantIds.length > 0
      ? (shareCents / 100).toFixed(2)
      : '0.00'

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{ title: isEditing ? t('mobile.splitExpenses.edit') : t('mobile.splitExpenses.addExpense') }}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <DsInput
          label={t('mobile.splitExpenses.expenseTitle')}
          value={title}
          onChangeText={setTitle}
          placeholder="Dinner at Mario's"
        />

        {/* Amount */}
        <View className="mt-4 gap-1.5">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('mobile.splitExpenses.expenseAmount')}
          </Text>
          <TextInput
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white bg-white dark:bg-gray-900"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#94A3B8"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
          />
        </View>

        {/* Paid by */}
        <View className="mt-4">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('mobile.splitExpenses.expensePaidBy')}
          </Text>
          <TouchableOpacity
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900"
            onPress={() => setShowPaidByPicker(!showPaidByPicker)}
            activeOpacity={0.7}
          >
            {paidBy ? (
              <View className="flex-row items-center gap-2">
                <DsAvatar
                  name={
                    activeMembers.find((m) => m.user_id === paidBy)
                      ?.display_name || '?'
                  }
                  size="sm"
                />
                <Text className="text-slate-900 dark:text-white">
                  {activeMembers.find((m) => m.user_id === paidBy)
                    ?.display_name || 'Unknown'}
                </Text>
              </View>
            ) : (
              <Text className="text-slate-400">Select who paid</Text>
            )}
          </TouchableOpacity>
          {showPaidByPicker && (
            <View className="mt-2 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {activeMembers.map((m) => (
                <TouchableOpacity
                  key={m.user_id}
                  className={`flex-row items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${
                    paidBy === m.user_id ? 'bg-primary/5' : ''
                  }`}
                  onPress={() => {
                    setPaidBy(m.user_id)
                    setShowPaidByPicker(false)
                  }}
                  activeOpacity={0.7}
                >
                  <DsAvatar name={m.display_name || '?'} size="sm" />
                  <Text className="text-sm text-slate-900 dark:text-white flex-1">
                    {m.display_name || 'User'}
                  </Text>
                  {paidBy === m.user_id && (
                    <Text className="text-primary font-bold">✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Participants */}
        <View className="mt-4">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('mobile.splitExpenses.expenseParticipants')} ({participantIds.length})
          </Text>
          <View className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {activeMembers.map((m) => (
              <TouchableOpacity
                key={m.user_id}
                className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800"
                onPress={() => handleToggleParticipant(m.user_id)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-2">
                  <DsAvatar name={m.display_name || '?'} size="sm" />
                  <Text className="text-sm text-slate-900 dark:text-white">
                    {m.display_name || 'User'}
                  </Text>
                </View>
                <View
                  className={`w-5 h-5 rounded border-2 items-center justify-center ${
                    participantIds.includes(m.user_id)
                      ? 'bg-primary border-primary'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {participantIds.includes(m.user_id) && (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tag */}
        <View className="mt-4">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('mobile.splitExpenses.expenseTag')}
          </Text>
          <TouchableOpacity
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900"
            onPress={() => setShowTagPicker(!showTagPicker)}
            activeOpacity={0.7}
          >
            {tagId ? (
              <View className="flex-row items-center gap-2">
                <View
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: tags.find((t: Tag) => t.id === tagId)
                      ?.color || '#94A3B8',
                  }}
                />
                <Text className="text-slate-900 dark:text-white">
                  {tags.find((t: Tag) => t.id === tagId)?.name || 'Unknown'}
                </Text>
              </View>
            ) : (
              <Text className="text-slate-400">No tag</Text>
            )}
          </TouchableOpacity>
          {showTagPicker && (
            <View className="mt-2 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <TouchableOpacity
                className="px-4 py-3 border-b border-slate-100 dark:border-slate-800"
                onPress={() => {
                  setTagId('')
                  setShowTagPicker(false)
                }}
                activeOpacity={0.7}
              >
                <Text className="text-sm text-slate-500">No tag</Text>
              </TouchableOpacity>
              {tags.map((t: Tag) => (
                <TouchableOpacity
                  key={t.id}
                  className={`flex-row items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${
                    tagId === t.id ? 'bg-primary/5' : ''
                  }`}
                  onPress={() => {
                    setTagId(t.id)
                    setShowTagPicker(false)
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <Text className="text-sm text-slate-900 dark:text-white flex-1">
                    {t.name}
                  </Text>
                  {tagId === t.id && (
                    <Text className="text-primary font-bold">✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Split type */}
        {participantIds.length > 1 && (
          <View className="mt-4">
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Split type
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  splitType === 'equal'
                    ? 'bg-primary'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
                onPress={() => setSplitType('equal')}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold ${
                    splitType === 'equal' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t('mobile.splitExpenses.expenseSplitEqual')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  splitType === 'custom'
                    ? 'bg-primary'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
                onPress={() => setSplitType('custom')}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-semibold ${
                    splitType === 'custom' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t('mobile.splitExpenses.expenseSplitCustom')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Custom amounts */}
        {splitType === 'custom' && participantIds.length > 0 && (
          <View className="mt-2">
            {activeMembers
              .filter((m: Member) => participantIds.includes(m.user_id))
              .map((m: Member) => (
                <View
                  key={m.user_id}
                  className="flex-row items-center gap-3 mt-2"
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    <DsAvatar name={m.display_name || '?'} size="sm" />
                    <Text className="text-sm text-slate-700 dark:text-slate-300">
                      {m.display_name || 'User'}
                    </Text>
                  </View>
                  <TextInput
                    className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-gray-900 w-24 text-right"
                    value={customAmounts[m.user_id] || ''}
                    onChangeText={(text) =>
                      setCustomAmounts((prev) => ({
                        ...prev,
                        [m.user_id]: text,
                      }))
                    }
                    placeholder={equalShare}
                    placeholderTextColor="#94A3B8"
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
                  />
                </View>
              ))}
          </View>
        )}

        {/* Equal preview */}
        {splitType === 'equal' && participantIds.length > 0 && numAmount > 0 && (
          <View className="mt-4 bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
            <Text className="text-xs text-slate-500 mb-1">
              Each person pays
            </Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">
              {equalShare} {activeMembers[0]?.display_name ? '' : ''}
            </Text>
            <Text className="text-xs text-slate-400 mt-0.5">
              {numAmount} ÷ {participantIds.length}
            </Text>
          </View>
        )}

        {/* Error */}
        {formError ? (
          <Text className="text-xs text-red-500 mt-4">{formError}</Text>
        ) : null}

        {/* Save */}
        <TouchableOpacity
          className={`rounded-xl py-3.5 items-center mt-6 ${
            saving ? 'bg-primary/50' : 'bg-primary'
          }`}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">
              {isEditing ? t('mobile.splitExpenses.save') : t('mobile.splitExpenses.addExpense')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
