import type { Meta, StoryObj } from '@storybook/react'
import { StatCard } from './stat-card'

const meta: Meta<typeof StatCard> = {
  title: 'Composite/StatCard',
  component: StatCard,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof StatCard>

export const Default: Story = {
  args: { label: 'Tareas hoy', value: '3', color: '#4F46E5' },
}

export const WithIcon: Story = {
  args: { label: 'Gastos mes', value: '€234', color: '#10B981', icon: '💰' },
}

export const Grid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <StatCard label="Tareas hoy" value="3" color="#4F46E5" />
      <StatCard label="Ideas activas" value="8" color="#F59E0B" />
      <StatCard label="Gastos mes" value="€234" color="#10B981" />
      <StatCard label="Miembros" value="5" color="var(--color-brand)" />
    </div>
  ),
}
