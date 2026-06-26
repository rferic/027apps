import { Stack } from 'expo-router'

export default function ModulesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#9B1C1C' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="todo/index" options={{ title: 'TODO' }} />
      <Stack.Screen name="todo/[id]" options={{ title: 'TODO Detail' }} />
      <Stack.Screen name="inspiration/index" options={{ title: 'Inspiration' }} />
      <Stack.Screen name="inspiration/[id]" options={{ title: 'Idea Detail' }} />
    </Stack>
  )
}
