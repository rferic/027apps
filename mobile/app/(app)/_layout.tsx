import { Tabs } from 'expo-router'
import { Text, type ColorValue } from 'react-native'

function TabIcon({ label, color }: { label: string; color: ColorValue }) {
  return <Text style={{ color: color as string, fontSize: 22 }}>{label}</Text>
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#9B1C1C' },
        headerTintColor: '#fff',
        tabBarActiveTintColor: '#9B1C1C',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { borderTopWidth: 1, borderTopColor: '#E2E8F0' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon label="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: 'Modules',
          tabBarLabel: 'Apps',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon label="📦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon label="⚙️" color={color} />,
        }}
      />
    </Tabs>
  )
}
