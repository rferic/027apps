import type { Meta, StoryObj } from '@storybook/react'
import { DsModal } from './modal'
import { useState } from 'react'
import { DsButton } from './button'

const meta: Meta<typeof DsModal> = {
  title: 'Design System/Modal',
  component: DsModal,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsModal>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <DsButton onClick={() => setOpen(true)}>Open Modal</DsButton>
        <DsModal open={open} onClose={() => setOpen(false)} title="Modal Title">
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            This is the modal content. Click the backdrop or press Escape to close.
          </p>
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <DsButton onClick={() => setOpen(false)}>Confirm</DsButton>
            <DsButton variant="secondary" onClick={() => setOpen(false)}>Cancel</DsButton>
          </div>
        </DsModal>
      </>
    )
  },
}
