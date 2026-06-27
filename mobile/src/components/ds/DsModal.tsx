import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native'
import type { ReactNode } from 'react'

export interface DsModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function DsModal({ open, onClose, title, children }: DsModalProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center p-4"
        onPress={onClose}
      >
        <Pressable
          className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md"
          onPress={() => {}}
        >
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <Text className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text className="text-slate-400 dark:text-slate-500 text-xl leading-5">
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          <View className="p-5">{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
