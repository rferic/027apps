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
      <Stack.Screen name="todo/create" options={{ title: 'New TODO', presentation: 'modal' }} />
      <Stack.Screen name="inspiration/index" options={{ title: 'Inspiration' }} />
      <Stack.Screen name="inspiration/[id]" options={{ title: 'Idea Detail' }} />
      <Stack.Screen name="inspiration/create" options={{ title: 'New Idea', presentation: 'modal' }} />
      <Stack.Screen name="split-expenses/index" options={{ title: 'Split Expenses' }} />
      <Stack.Screen name="split-expenses/[id]" options={{ title: 'Expenses', headerShown: false }} />
      <Stack.Screen name="split-expenses/[id]/expense/new" options={{ title: 'New Expense', presentation: 'modal' }} />
      <Stack.Screen name="split-expenses/[id]/expense/[expenseId]" options={{ title: 'Expense Detail', presentation: 'modal' }} />
      <Stack.Screen name="split-expenses/[id]/transfer" options={{ title: 'Transfer', presentation: 'modal' }} />
    </Stack>
  )
}
