import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { TodoList, type TodoItemData } from './todo-list'

const meta: Meta<typeof TodoList> = {
  title: 'Composite/TodoList',
  component: TodoList,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof TodoList>

const sampleItems: TodoItemData[] = [
  { id: '1', title: 'Comprar leche y pan', priority: 'medium', category: 'Hogar', emoji: '🏠', due: 'Hoy', assignee: 'Eric', done: false },
  { id: '2', title: 'Pedir cita pediatra', priority: 'high', category: 'Nico', emoji: '👶', due: 'Mañana', assignee: 'Eric', done: false },
  { id: '3', title: 'Pagar factura luz', priority: 'urgent', category: 'Finanzas', emoji: '💰', due: 'Viernes', assignee: 'María', done: false },
  { id: '4', title: 'Lavar el coche', priority: 'low', category: 'Casa', emoji: '🚗', due: 'Sábado', assignee: '', done: true },
]

export const Default: Story = {
  args: { items: sampleItems },
}

export const Interactive: Story = {
  render: () => {
    const [items, setItems] = useState(sampleItems)
    return (
      <TodoList
        items={items}
        onToggle={(id) => setItems(items.map(i => i.id === id ? { ...i, done: !i.done } : i))}
        onNew={() => alert('New task')}
        onClick={(id) => alert(`Clicked task ${id}`)}
        onViewAll={() => alert('View all')}
      />
    )
  },
}
