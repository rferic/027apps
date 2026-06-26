import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent } from 'storybook/test'
import { TodoItem, type TodoItemData } from './todo-item'

const meta = {
  component: TodoItem,
  tags: ['ai-generated'],
} satisfies Meta<typeof TodoItem>

export default meta
type Story = StoryObj<typeof meta>

const baseItem: TodoItemData = {
  id: '1',
  title: 'Buy groceries',
  priority: 'medium',
  category: 'Personal',
  emoji: '🛒',
  due: 'Tomorrow',
  assignee: 'Alice',
  done: false,
}

export const Default: Story = {
  args: { item: baseItem },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Buy groceries')).toBeVisible()
    await expect(canvas.getByText('medium')).toBeVisible()
    await expect(canvas.getByText('🛒 Personal')).toBeVisible()
  },
}

export const Done: Story = {
  args: {
    item: { ...baseItem, done: true },
  },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole('checkbox')
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  },
}

export const Urgent: Story = {
  args: {
    item: { ...baseItem, priority: 'urgent', due: 'Hoy' },
  },
  play: async ({ canvas }) => {
    // "Hoy" with warning prefix renders in the due text
    await expect(canvas.getByText('urgent')).toBeVisible()
  },
}

export const NoAssignee: Story = {
  args: {
    item: { ...baseItem, assignee: '', due: 'Next week' },
  },
  play: async ({ canvas }) => {
    // Should not show avatar when no assignee
    await expect(canvas.queryByText('A')).toBeNull()
  },
}

export const WithToggle: Story = {
  args: {
    item: baseItem,
    onToggle: () => {},
  },
  play: async ({ canvas }) => {
    const checkbox = canvas.getByRole('checkbox')
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(checkbox)
    // aria-checked stays false because onToggle is a noop
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  },
}

export const WithClick: Story = {
  args: {
    item: baseItem,
    onClick: () => {},
  },
  play: async ({ canvas }) => {
    const title = canvas.getByText('Buy groceries')
    await expect(title).toBeVisible()
  },
}
