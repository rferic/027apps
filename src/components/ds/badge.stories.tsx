import type { Meta, StoryObj } from '@storybook/react'
import { DsBadge } from './badge'

const meta: Meta<typeof DsBadge> = {
  title: 'Design System/Badge',
  component: DsBadge,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'success', 'warning', 'error', 'neutral', 'outline'] },
    children: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof DsBadge>

export const Primary: Story = {
  args: { children: 'Primary', variant: 'primary' },
}

export const Success: Story = {
  args: { children: 'Success', variant: 'success' },
}

export const Warning: Story = {
  args: { children: 'Warning', variant: 'warning' },
}

export const Error: Story = {
  args: { children: 'Error', variant: 'error' },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <DsBadge variant="primary">Primary</DsBadge>
      <DsBadge variant="success">Success</DsBadge>
      <DsBadge variant="warning">Warning</DsBadge>
      <DsBadge variant="error">Error</DsBadge>
      <DsBadge variant="neutral">Neutral</DsBadge>
      <DsBadge variant="outline">Outline</DsBadge>
    </div>
  ),
}
