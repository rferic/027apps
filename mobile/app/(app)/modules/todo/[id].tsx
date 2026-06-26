import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { mockTodos, type TodoItem } from '@/lib/mock-data'

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
}

// TODO: Replace with API call via getApiClient() when endpoints are ready

export default function TodoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const todoId = Number(id)
  const todo = mockTodos.find((t) => t.id === todoId)

  if (!todo) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-slate-400 mb-2">TODO not found</Text>
        <TouchableOpacity
          className="bg-[#9B1C1C] rounded-lg py-2 px-6"
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text className="text-white font-medium">Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <TodoDetailContent todo={todo} router={router} />
  )
}

function TodoDetailContent({
  todo: initialTodo,
  router,
}: {
  todo: TodoItem
  router: ReturnType<typeof useRouter>
}) {
  const [todo, setTodo] = useState(initialTodo)
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description)
  const [saving, setSaving] = useState(false)

  const handleToggle = () => {
    const updated = { ...todo, completed: !todo.completed }
    setTodo(updated)
    const idx = mockTodos.findIndex((t) => t.id === todo.id)
    if (idx !== -1) mockTodos[idx] = updated
  }

  const handleSave = () => {
    if (!title.trim()) return
    setSaving(true)
    const updated = { ...todo, title: title.trim(), description: description.trim() }
    // TODO: PATCH to API
    setTodo(updated)
    const idx = mockTodos.findIndex((t) => t.id === todo.id)
    if (idx !== -1) mockTodos[idx] = updated
    setTimeout(() => setSaving(false), 300)
  }

  const handleDelete = () => {
    Alert.alert('Delete TODO', `Are you sure you want to delete "${todo.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const idx = mockTodos.findIndex((t) => t.id === todo.id)
          if (idx !== -1) mockTodos.splice(idx, 1)
          router.back()
        },
      },
    ])
  }

  const createdAt = new Date(todo.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Completed toggle */}
      <TouchableOpacity
        className={`flex-row items-center p-4 rounded-xl mb-4 ${
          todo.completed ? 'bg-green-50 border border-green-200' : 'bg-white border border-slate-100'
        }`}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View
          className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
            todo.completed ? 'bg-[#9B1C1C] border-[#9B1C1C]' : 'border-slate-300'
          }`}
        >
          {todo.completed && <Text className="text-white text-xs font-bold">✓</Text>}
        </View>
        <Text className={`text-base font-semibold ${todo.completed ? 'text-green-700' : 'text-[#1E293B]'}`}>
          {todo.completed ? 'Completed' : 'Mark as completed'}
        </Text>
      </TouchableOpacity>

      {/* Title */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">TITLE</Text>
        <TextInput
          className="text-base text-[#1E293B] font-semibold border border-slate-200 rounded-lg px-4 py-3"
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Description */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">DESCRIPTION</Text>
        <TextInput
          className="text-base text-[#1E293B] border border-slate-200 rounded-lg px-4 py-3"
          value={description}
          onChangeText={setDescription}
          placeholder="Add a description..."
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{ minHeight: 100 }}
        />
      </View>

      {/* Priority */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">PRIORITY</Text>
        <View className={`rounded-full px-3 py-1 self-start ${PRIORITY_STYLES[todo.priority]}`}>
          <Text className="text-sm font-medium capitalize">{todo.priority}</Text>
        </View>
      </View>

      {/* Visibility */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">VISIBILITY</Text>
        <Text className="text-sm text-slate-600 capitalize">{todo.visibility}</Text>
      </View>

      {/* Created at */}
      <View className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3">
        <Text className="text-xs text-slate-400 mb-1 font-medium">CREATED</Text>
        <Text className="text-sm text-slate-600">{createdAt}</Text>
      </View>

      {/* Save button */}
      {(title !== todo.title || description !== todo.description) && (
        <TouchableOpacity
          className="bg-[#9B1C1C] rounded-xl py-3 items-center mb-3"
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-base font-semibold">Save Changes</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Delete button */}
      <TouchableOpacity
        className="border border-red-300 rounded-xl py-3 items-center"
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Text className="text-red-600 text-base font-semibold">Delete TODO</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
