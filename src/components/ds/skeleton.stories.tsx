import type { Meta, StoryObj } from '@storybook/react'
import { DsSkeleton } from './skeleton'

const meta: Meta<typeof DsSkeleton> = {
  title: 'Design System/Skeleton',
  component: DsSkeleton,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsSkeleton>

export const Default: Story = {
  args: { height: 16, count: 1 },
}

export const CardLoading: Story = {
  render: () => (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: 20, border: '1px solid var(--color-border)', maxWidth: 300 }}>
      <DsSkeleton height={120} count={1} />
      <div style={{ height: 12 }} />
      <DsSkeleton height={16} count={3} />
    </div>
  ),
}

export const AvatarLoading: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <DsSkeleton height={40} circle />
      <div style={{ flex: 1 }}>
        <DsSkeleton height={14} count={2} />
      </div>
    </div>
  ),
}
