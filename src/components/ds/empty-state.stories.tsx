import type { Meta, StoryObj } from '@storybook/react'
import { DsEmptyState } from './empty-state'
import { DsButton } from './button'

const meta: Meta<typeof DsEmptyState> = {
  title: 'Design System/Empty State',
  component: DsEmptyState,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsEmptyState>

export const Default: Story = {
  args: {
    title: 'No tasks yet',
    description: 'Create your first task to get started.',
    icon: '📋',
  },
}

export const WithAction: Story = {
  args: {
    title: 'No ideas yet',
    description: 'Be the first to share an idea with your group.',
    icon: '💡',
    action: <DsButton size="sm">New Idea</DsButton>,
  },
}
