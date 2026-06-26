import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { getActiveGroupSlug, setActiveGroupSlug } from '@/lib/group-store'

interface Group {
  id: string
  slug: string
  name: string
  role: string
}

interface Props {
  groups: Group[]
  isLoading: boolean
  onGroupChange?: (slug: string) => void
  visible?: boolean
  onClose?: () => void
}

export function GroupSwitcher({ groups, isLoading, onGroupChange, visible, onClose }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [isModalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    getActiveGroupSlug().then(setActiveSlug)
  }, [])

  const activeGroup = groups.find((g) => g.slug === activeSlug) ?? groups[0]

  const handleSelect = async (group: Group) => {
    await setActiveGroupSlug(group.slug)
    setActiveSlug(group.slug)
    setModalVisible(false)
    onClose?.()
    onGroupChange?.(group.slug)
  }

  // When controlled externally, use visible prop
  const showModal = visible !== undefined ? visible : isModalVisible
  const closeModal = () => {
    setModalVisible(false)
    onClose?.()
  }

  if (isLoading) {
    return (
      <View className="flex-row items-center px-3 py-2">
        <ActivityIndicator size="small" color="#9B1C1C" />
      </View>
    )
  }

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center px-3 py-2"
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text className="text-white text-sm font-medium">
          {activeGroup?.name ?? 'Select group'}
        </Text>
        <Text className="text-white/60 text-xs ml-1">▼</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-center items-center"
          activeOpacity={1}
          onPress={closeModal}
        >
          <TouchableOpacity
            className="bg-white rounded-xl w-80 max-h-96"
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text className="text-lg font-semibold text-[#1E293B] px-6 pt-6 pb-3">
              Select group
            </Text>
            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`flex-row items-center px-6 py-3 border-b border-slate-100 ${
                    item.slug === activeSlug ? 'bg-red-50' : ''
                  }`}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1">
                    <Text
                      className={`text-base ${
                        item.slug === activeSlug
                          ? 'text-[#9B1C1C] font-semibold'
                          : 'text-[#1E293B]'
                      }`}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-xs text-slate-400">{item.role}</Text>
                  </View>
                  {item.slug === activeSlug && (
                    <Text className="text-[#9B1C1C] text-sm font-bold">✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-slate-400 text-center py-8 px-6">
                  No groups available
                </Text>
              }
            />
            <TouchableOpacity
              className="items-center py-4 border-t border-slate-100"
              onPress={closeModal}
              activeOpacity={0.7}
            >
              <Text className="text-slate-500 text-base">Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  )
}
