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
import { useSplitExpenses } from '@/hooks/useSplitExpenses'
import { DsInput } from '@/components/ds/DsInput'
import { DsAvatar } from '@/components/ds/DsAvatar'

export default function CreateTransferScreen() {
  const { id: groupId, transferId } = useLocalSearchParams<{
    id: string
    transferId?: string
  }>()
  const router = useRouter()
  const hook = useSplitExpenses(groupId)
  const {
    members,
    transfers,
    createTransfer,
    updateTransfer,
    balances,
    formatAmount,
  } = hook

  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [showFromPicker, setShowFromPicker] = useState(false)
  const [showToPicker, setShowToPicker] = useState(false)

  const isEditing = !!transferId

  // Reset loaded when groupId changes so pre-selection re-runs
  useEffect(() => {
    setLoaded(false)
  }, [groupId])

  // Prefill from suggested transfer if passed via params
  // Prefill form when editing an existing transfer
  useEffect(() => {
    if (transferId) {
      const existing = transfers.find((t) => t.id === transferId)
      if (existing && !loaded) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFromUser(existing.from_user)
        setToUser(existing.to_user)
        setAmount(existing.amount.toString())
        setNote(existing.note || '')
        setDate(existing.created_at?.split('T')[0] || new Date().toISOString().split('T')[0])
        setLoaded(true)
      }
    }
  }, [transferId, transfers, loaded])

  const activeMembers = members

  const handleSave = useCallback(async () => {
    setFormError('')
    const numAmount = parseFloat(amount)

    if (!fromUser) {
      setFormError('Select who is paying')
      return
    }
    if (!toUser) {
      setFormError('Select who receives')
      return
    }
    if (fromUser === toUser) {
      setFormError('Sender and receiver must be different')
      return
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setFormError('Valid amount is required')
      return
    }

    setSaving(true)
    try {
      const data = {
        from_user: fromUser,
        to_user: toUser,
        amount: numAmount,
        note: note.trim() || undefined,
        created_at: date || undefined,
      }

      if (isEditing && transferId) {
        await updateTransfer(transferId, data)
      } else {
        await createTransfer(data)
      }
      router.back()
    } catch {
      setFormError('Failed to save transfer')
    } finally {
      setSaving(false)
    }
  }, [
    fromUser,
    toUser,
    amount,
    note,
    date,
    isEditing,
    transferId,
    createTransfer,
    updateTransfer,
    router,
  ])

  const fromMember = activeMembers.find((m) => m.user_id === fromUser)
  const toMember = activeMembers.find((m) => m.user_id === toUser)

  // Pre-select based on balances if creating new transfer
  // Pre-select based on balances if creating new transfer
  useEffect(() => {
    if (!isEditing && !loaded && balances.length > 0 && !fromUser && !toUser) {
      const payer = balances.find((b) => b.net_balance < 0)
      const receiver = balances.find((b) => b.net_balance > 0)
      if (payer && receiver) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFromUser(payer.user_id)
        setToUser(receiver.user_id)
        setAmount(Math.abs(payer.net_balance).toFixed(2))
      }
      setLoaded(true)
    }
  }, [isEditing, loaded, balances, fromUser, toUser])

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{ title: isEditing ? 'Edit Transfer' : 'New Transfer' }}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* From */}
        <View>
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            From
          </Text>
          <TouchableOpacity
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900"
            onPress={() => {
              setShowFromPicker(!showFromPicker)
              setShowToPicker(false)
            }}
            activeOpacity={0.7}
          >
            {fromMember ? (
              <View className="flex-row items-center gap-2">
                <DsAvatar
                  name={fromMember.display_name || '?'}
                  size="sm"
                />
                <Text className="text-slate-900 dark:text-white">
                  {fromMember.display_name || 'User'}
                </Text>
              </View>
            ) : (
              <Text className="text-slate-400">Who pays</Text>
            )}
          </TouchableOpacity>
          {showFromPicker && (
            <View className="mt-2 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {activeMembers.map((m) => (
                <TouchableOpacity
                  key={m.user_id}
                  className={`flex-row items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${
                    fromUser === m.user_id ? 'bg-primary/5' : ''
                  }`}
                  onPress={() => {
                    setFromUser(m.user_id)
                    setShowFromPicker(false)
                  }}
                  activeOpacity={0.7}
                >
                  <DsAvatar name={m.display_name || '?'} size="sm" />
                  <Text className="text-sm text-slate-900 dark:text-white flex-1">
                    {m.display_name || 'User'}
                  </Text>
                  {fromUser === m.user_id && (
                    <Text className="text-primary font-bold">✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Arrow */}
        <View className="items-center py-3">
          <Text className="text-2xl text-slate-400">↓</Text>
        </View>

        {/* To */}
        <View>
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            To
          </Text>
          <TouchableOpacity
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900"
            onPress={() => {
              setShowToPicker(!showToPicker)
              setShowFromPicker(false)
            }}
            activeOpacity={0.7}
          >
            {toMember ? (
              <View className="flex-row items-center gap-2">
                <DsAvatar name={toMember.display_name || '?'} size="sm" />
                <Text className="text-slate-900 dark:text-white">
                  {toMember.display_name || 'User'}
                </Text>
              </View>
            ) : (
              <Text className="text-slate-400">Who receives</Text>
            )}
          </TouchableOpacity>
          {showToPicker && (
            <View className="mt-2 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {activeMembers
                .filter((m) => m.user_id !== fromUser)
                .map((m) => (
                  <TouchableOpacity
                    key={m.user_id}
                    className={`flex-row items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${
                      toUser === m.user_id ? 'bg-primary/5' : ''
                    }`}
                    onPress={() => {
                      setToUser(m.user_id)
                      setShowToPicker(false)
                    }}
                    activeOpacity={0.7}
                  >
                    <DsAvatar name={m.display_name || '?'} size="sm" />
                    <Text className="text-sm text-slate-900 dark:text-white flex-1">
                      {m.display_name || 'User'}
                    </Text>
                    {toUser === m.user_id && (
                      <Text className="text-primary font-bold">✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>

        {/* Amount */}
        <View className="mt-4 gap-1.5">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Amount
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

        {/* Note */}
        <View className="mt-4">
          <DsInput
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="For dinner last night"
          />
        </View>

        {/* Date */}
        <View className="mt-4 gap-1.5">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Date (optional)
          </Text>
          <TextInput
            className="border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white bg-white dark:bg-gray-900"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Preview */}
        {fromMember && toMember && amount && !isNaN(parseFloat(amount)) && (
          <View className="mt-4 bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
            <Text className="text-xs text-slate-400 mb-1">Transfer preview</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-slate-900 dark:text-white">
                {fromMember.display_name || 'User'}
              </Text>
              <Text className="text-slate-400">pays</Text>
              <Text className="text-sm font-bold text-emerald-600">
                {formatAmount(parseFloat(amount))}
              </Text>
              <Text className="text-slate-400">to</Text>
              <Text className="text-sm font-semibold text-slate-900 dark:text-white">
                {toMember.display_name || 'User'}
              </Text>
            </View>
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
              {isEditing ? 'Save Changes' : 'Create Transfer'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
