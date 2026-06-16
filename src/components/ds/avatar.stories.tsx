import type { Meta, StoryObj } from '@storybook/react'
import { DsAvatar } from './avatar'

const meta: Meta<typeof DsAvatar> = {
  title: 'Design System/Avatar',
  component: DsAvatar,
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'number', min: 16, max: 80 } },
    color: { control: 'color' },
  },
}

export default meta
type Story = StoryObj<typeof DsAvatar>

export const Default: Story = {
  args: { children: 'ER', size: 32 },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <DsAvatar size={24}>ER</DsAvatar>
      <DsAvatar size={32}>ER</DsAvatar>
      <DsAvatar size={40}>ER</DsAvatar>
      <DsAvatar size={48}>ER</DsAvatar>
    </div>
  ),
}

export const CustomColor: Story = {
  args: { children: 'FA', size: 36, color: '#F59E0B' },
}

export const WithInitials: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <DsAvatar size={36}>ER</DsAvatar>
      <DsAvatar size={36} color="#4F46E5">JD</DsAvatar>
      <DsAvatar size={36} color="#10B981">MA</DsAvatar>
      <DsAvatar size={36} color="#F59E0B">AL</DsAvatar>
    </div>
  ),
}
