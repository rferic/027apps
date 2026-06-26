import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { RequestType } from '../../../../../apps/inspiration/native'

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'new_app', label: 'New App' },
  { value: 'new_app_feature', label: 'New App Feature' },
  { value: 'new_general_functionality', label: 'New Functionality' },
  { value: 'other', label: 'Other' },
]

// Mock installed apps — would come from API in production
const INSTALLED_APPS = [
  { slug: '027apps', name: '027apps' },
]

export default function CreateInspirationScreen() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<RequestType>('improvement')
  const [appSlug, setAppSlug] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isValid = title.trim().length > 0 && type

  const handleSubmit = () => {
    if (!isValid) {
      Alert.alert('Validation', 'Title and type are required.')
      return
    }
    setSubmitting(true)
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false)
      router.back()
    }, 500)
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text className="text-sm font-semibold text-slate-600 mb-1.5">Title *</Text>
      <TextInput
        className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-base text-slate-800 mb-4"
        placeholder="What's your idea?"
        placeholderTextColor="#94A3B8"
        value={title}
        onChangeText={setTitle}
        maxLength={200}
      />

      {/* Description */}
      <Text className="text-sm font-semibold text-slate-600 mb-1.5">Description</Text>
      <TextInput
        className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-base text-slate-800 mb-4"
        placeholder="Add more details..."
        placeholderTextColor="#94A3B8"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{ minHeight: 100 }}
      />

      {/* Type selector */}
      <Text className="text-sm font-semibold text-slate-600 mb-1.5">Type *</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {REQUEST_TYPES.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setType(opt.value)}
            className={`rounded-lg px-3.5 py-2 border ${
              type === opt.value
                ? 'bg-amber-500 border-amber-500'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                type === opt.value ? 'text-white' : 'text-slate-600'
              }`}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* App selector */}
      <Text className="text-sm font-semibold text-slate-600 mb-1.5">App (optional)</Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        <TouchableOpacity
          onPress={() => setAppSlug(null)}
          className={`rounded-lg px-3.5 py-2 border ${
            appSlug === null ? 'bg-amber-500 border-amber-500' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              appSlug === null ? 'text-white' : 'text-slate-600'
            }`}
          >
            None
          </Text>
        </TouchableOpacity>
        {INSTALLED_APPS.map(app => (
          <TouchableOpacity
            key={app.slug}
            onPress={() => setAppSlug(app.slug)}
            className={`rounded-lg px-3.5 py-2 border ${
              appSlug === app.slug ? 'bg-amber-500 border-amber-500' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                appSlug === app.slug ? 'text-white' : 'text-slate-600'
              }`}
            >
              {app.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Submit */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!isValid || submitting}
        className={`rounded-xl py-3.5 items-center ${
          isValid && !submitting ? 'bg-amber-500' : 'bg-slate-200'
        }`}
      >
        <Text
          className={`text-base font-semibold ${
            isValid && !submitting ? 'text-white' : 'text-slate-400'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Idea'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
