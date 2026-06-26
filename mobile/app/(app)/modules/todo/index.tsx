import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { TodoCard } from '@/components/TodoCard'
import { mockTodos, type TodoItem } from '@/lib/mock-data'

type TabId = 'mine' | 'group'
type FilterId = 'all' | 'active' | 'completed'

const TABS: { id: TabId; label: string }[] = [
  { id: 'mine', label: 'Mis TODOs' },
  { id: 'group', label: 'TODOs del grupo' },
]

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
]

export default function TodoListScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('mine')
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [todos, setTodos] = useState<TodoItem[]>(mockTodos)

  const handleToggle = useCallback((id: number) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }, [])

  const handlePress = useCallback(
    (id: number) => {
      router.push(`/(app)/modules/todo/${id}`)
    },
    [router]
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // TODO: fetch from API
    await new Promise((r) => setTimeout(r, 600))
    setRefreshing(false)
  }, [])

  // Filtering
  const filteredTodos = todos.filter((t) => {
    if (activeFilter === 'active') return !t.completed
    if (activeFilter === 'completed') return t.completed
    return true
  })

  // Active / completed counts
  const activeCount = todos.filter((t) => !t.completed).length
  const completedCount = todos.filter((t) => t.completed).length

  const renderItem = useCallback(
    ({ item }: { item: TodoItem }) => (
      <TodoCard
        id={item.id}
        title={item.title}
        completed={item.completed}
        priority={item.priority}
        createdAt={item.created_at}
        onToggle={handleToggle}
        onPress={handlePress}
      />
    ),
    [handleToggle, handlePress]
  )

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-16">
      <Text className="text-4xl mb-4">📋</Text>
      <Text className="text-lg font-semibold text-[#1E293B] mb-1">No TODOs yet</Text>
      <Text className="text-sm text-slate-400 text-center px-8">
        Tap the + button to create your first task
      </Text>
    </View>
  )

  return (
    <View className="flex-1 bg-slate-50">
      {/* Tabs */}
      <View className="bg-white border-b border-slate-100">
        <View className="flex-row px-4 pt-3">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              className={`flex-1 py-2 items-center border-b-2 ${
                activeTab === tab.id ? 'border-[#9B1C1C]' : 'border-transparent'
              }`}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-semibold ${
                  activeTab === tab.id ? 'text-[#9B1C1C]' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Filters */}
      <View className="flex-row px-4 py-3 gap-2 bg-white">
        {FILTERS.map((filter) => {
          const count =
            filter.id === 'active'
              ? activeCount
              : filter.id === 'completed'
                ? completedCount
                : todos.length
          return (
            <TouchableOpacity
              key={filter.id}
              className={`rounded-full px-3 py-1 ${
                activeFilter === filter.id
                  ? 'bg-[#9B1C1C]'
                  : 'bg-slate-100'
              }`}
              onPress={() => setActiveFilter(filter.id)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  activeFilter === filter.id ? 'text-white' : 'text-slate-500'
                }`}
              >
                {filter.label} ({count})
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* List */}
      <FlatList
        data={filteredTodos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#9B1C1C"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[#9B1C1C] items-center justify-center shadow-lg"
        onPress={() => router.push('/(app)/modules/todo/create')}
        activeOpacity={0.8}
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </TouchableOpacity>
    </View>
  )
}
