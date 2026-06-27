import { ScrollView, Text, TouchableOpacity } from 'react-native'

export interface TabItem {
  key: string
  label: string
}

export interface DsTabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (key: string) => void
}

export function DsTabs({ tabs, activeTab, onChange }: DsTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-row border-b border-slate-200 dark:border-slate-700"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <TouchableOpacity
            key={tab.key}
            className={`px-4 py-3 border-b-2 ${
              isActive
                ? 'border-primary'
                : 'border-transparent'
            }`}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive
                  ? 'text-primary'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}
