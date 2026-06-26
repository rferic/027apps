import type { Meta, StoryObj } from '@storybook/react'
import { DsButton } from './button'

const meta: Meta<typeof DsButton> = {
  title: 'Design System/Button',
  component: DsButton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    color: { control: 'color' },
    children: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof DsButton>

export const Primary: Story = {
  args: { children: 'Primary', variant: 'primary' },
}

export const CustomColor: Story = {
  args: { children: 'Emerald', variant: 'primary', color: '#10B981' },
}

export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
}

export const Outline: Story = {
  args: { children: 'Outline', variant: 'outline' },
}

export const Ghost: Story = {
  args: { children: 'Ghost', variant: 'ghost' },
}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <DsButton size="sm">Small</DsButton>
      <DsButton size="md">Medium</DsButton>
      <DsButton size="lg">Large</DsButton>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <DsButton variant="primary">Primary</DsButton>
      <DsButton variant="secondary">Secondary</DsButton>
      <DsButton variant="outline">Outline</DsButton>
      <DsButton variant="ghost">Ghost</DsButton>
    </div>
  ),
}
