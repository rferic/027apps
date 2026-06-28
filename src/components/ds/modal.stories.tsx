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

const DsModalContent = () => (
  <div>
    <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
      This is the modal content. Click the backdrop or press Escape to close.
    </p>
    <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
      <DsButton>Confirm</DsButton>
      <DsButton variant="secondary">Cancel</DsButton>
    </div>
  </div>
)

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

export const Small: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <DsModal open={open} onClose={() => setOpen(false)} title="Small Modal" maxWidth={400}>
        <DsModalContent />
      </DsModal>
    )
  },
}

export const Large: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <DsModal open={open} onClose={() => setOpen(false)} title="Large Modal" maxWidth={700}>
        <DsModalContent />
      </DsModal>
    )
  },
}

export const WithoutTitle: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <DsModal open={open} onClose={() => setOpen(false)}>
        <DsModalContent />
      </DsModal>
    )
  },
}
