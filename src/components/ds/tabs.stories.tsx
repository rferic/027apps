import type { Meta, StoryObj } from '@storybook/react'
import { DsTabs } from './tabs'

const meta: Meta<typeof DsTabs> = {
  title: 'Design System/Tabs',
  component: DsTabs,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsTabs>

const defaultTabs = [
  { id: 'tab1', label: 'Active', content: <p style={{ color: 'var(--color-text-secondary)' }}>Content for Active tab.</p> },
  { id: 'tab2', label: 'Pending', content: <p style={{ color: 'var(--color-text-secondary)' }}>Content for Pending tab.</p> },
  { id: 'tab3', label: 'Completed', content: <p style={{ color: 'var(--color-text-secondary)' }}>Content for Completed tab.</p> },
]

export const Default: Story = {
  args: { tabs: defaultTabs },
}
