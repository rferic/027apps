import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { mockTodos, todoIdCounter } from '@/lib/mock-data'
import { TodoCardProps } from '@/components/TodoCard'

type Priority = NonNullable<TodoCardProps['priority']>
type Visibility = 'private' | 'public'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const VISIBILITIES: { value: Visibility; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
]

// TODO: Replace with API call via getApiClient() when endpoints are ready

export default function CreateTodoScreen() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setError(null)
    setSubmitting(true)

    const newTodo = {
      id: todoIdCounter.next++,
      title: title.trim(),
      description: description.trim(),
      completed: false,
      priority,
      visibility,
      created_at: new Date().toISOString(),
      user_id: 'user-1',
      group_id: 'group-1',
    }

    mockTodos.unshift(newTodo)

    // TODO: POST to API

    setTimeout(() => {
      setSubmitting(false)
      router.back()
    }, 300)
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Title */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">TITLE *</Text>
        <TextInput
          className={`text-base text-[#1E293B] border rounded-lg px-4 py-3 ${
            error ? 'border-red-400' : 'border-slate-200'
          }`}
          value={title}
          onChangeText={(t) => {
            setTitle(t)
            if (error) setError(null)
          }}
          placeholder="What needs to be done?"
          placeholderTextColor="#94A3B8"
          autoFocus
        />
        {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
      </View>

      {/* Description */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">DESCRIPTION</Text>
        <TextInput
          className="text-base text-[#1E293B] border border-slate-200 rounded-lg px-4 py-3"
          value={description}
          onChangeText={setDescription}
          placeholder="Add details (optional)"
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 100 }}
        />
      </View>

      {/* Priority selector */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-3 font-medium">PRIORITY</Text>
        <View className="flex-row gap-2">
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.value}
              className={`flex-1 rounded-full py-2 items-center border ${
                priority === p.value
                  ? 'bg-[#9B1C1C] border-[#9B1C1C]'
                  : 'bg-white border-slate-200'
              }`}
              onPress={() => setPriority(p.value)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  priority === p.value ? 'text-white' : 'text-slate-600'
                }`}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Visibility selector */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-3 font-medium">VISIBILITY</Text>
        <View className="flex-row gap-2">
          {VISIBILITIES.map((v) => (
            <TouchableOpacity
              key={v.value}
              className={`flex-1 rounded-full py-2 items-center border ${
                visibility === v.value
                  ? 'bg-[#9B1C1C] border-[#9B1C1C]'
                  : 'bg-white border-slate-200'
              }`}
              onPress={() => setVisibility(v.value)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  visibility === v.value ? 'text-white' : 'text-slate-600'
                }`}
              >
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Create button */}
      <TouchableOpacity
        className="bg-[#9B1C1C] rounded-xl py-3 items-center"
        onPress={handleCreate}
        activeOpacity={0.8}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white text-base font-semibold">Create TODO</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}
