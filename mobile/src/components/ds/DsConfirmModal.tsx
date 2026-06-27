import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native'

export interface DsConfirmModalProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'success' | 'warning'
  onConfirm: () => void
}

const variantButtonClasses: Record<NonNullable<DsConfirmModalProps['variant']>, string> = {
  danger: 'bg-red-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
}

export function DsConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
}: DsConfirmModalProps) {
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
          className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm"
          onPress={() => {}}
        >
          <View className="p-5">
            <Text className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {title}
            </Text>
            <Text className="text-sm text-slate-400 dark:text-slate-500 mb-6">
              {message}
            </Text>
            <View className="flex-row gap-3 justify-end">
              <TouchableOpacity
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-5 py-2.5 rounded-xl ${variantButtonClasses[variant]}`}
                onPress={() => {
                  onConfirm()
                  onClose()
                }}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-semibold text-white">
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
