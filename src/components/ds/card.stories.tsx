import type { Meta, StoryObj } from '@storybook/react'
import { DsCard } from './card'
import { DsBadge } from './badge'

const meta: Meta<typeof DsCard> = {
  title: 'Design System/Card',
  component: DsCard,
  tags: ['autodocs'],
  argTypes: {
    padding: { control: 'select', options: ['sm', 'md', 'lg'] },
    hover: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof DsCard>

export const Default: Story = {
  args: {
    children: 'This is a card with default padding.',
  },
}

export const WithContent: Story = {
  render: () => (
    <DsCard padding="lg" style={{ maxWidth: 320 }}>
      <div style={{ width: '100%', height: 120, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--color-brand), #4A0E0E)', marginBottom: 12 }} />
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px' }}>Card Title</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: '0 0 12px' }}>Description of the card content goes here.</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <DsBadge variant="primary">Tag</DsBadge>
        <DsBadge variant="neutral">Info</DsBadge>
      </div>
    </DsCard>
  ),
}
