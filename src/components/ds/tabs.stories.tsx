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

export const ThreeTabs: Story = {
  args: {
    tabs: [
      { id: 'tab1', label: 'First' },
      { id: 'tab2', label: 'Second' },
      { id: 'tab3', label: 'Third' },
    ],
    defaultTab: 'tab1',
  },
}

export const ManyTabs: Story = {
  args: {
    tabs: [
      { id: 'expenses', label: 'Expenses' },
      { id: 'balances', label: 'Balances' },
      { id: 'stats', label: 'Stats' },
      { id: 'settings', label: 'Settings' },
    ],
    defaultTab: 'expenses',
  },
}
