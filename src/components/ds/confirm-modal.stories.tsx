import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { DsConfirmModal } from './confirm-modal'

const meta = {
  component: DsConfirmModal,
  tags: ['ai-generated'],
  argTypes: {
    variant: { control: 'select', options: ['danger', 'success'] },
  },
} satisfies Meta<typeof DsConfirmModal>

export default meta
type Story = StoryObj<typeof meta>

export const Danger: Story = {
  args: {
    open: true,
    title: 'Eliminar elemento',
    message: '¿Estás seguro? Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'danger',
    onConfirm: () => {},
    onClose: () => {},
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Eliminar elemento')).toBeVisible()
    await expect(canvas.getByText('¿Estás seguro? Esta acción no se puede deshacer.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /eliminar/i })).toBeVisible()
  },
}

export const DangerWithSummary: Story = {
  args: {
    open: true,
    title: 'Eliminar transferencia',
    message: '¿Eliminar esta transferencia?',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    variant: 'danger',
    onConfirm: () => {},
    onClose: () => {},
  },
  render: (args) => (
    <DsConfirmModal {...args}>
      <p style={{ margin: 0, color: 'var(--color-text)' }}>Tester → Eric RF</p>
      <p style={{ margin: '4px 0 0', fontWeight: 600, color: 'var(--color-text)' }}>€33.48</p>
    </DsConfirmModal>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Tester → Eric RF')).toBeVisible()
    await expect(canvas.getByText('€33.48')).toBeVisible()
  },
}

export const Success: Story = {
  args: {
    open: true,
    title: 'Confirmar liquidación',
    message: 'Esto marcará 2 gastos como liquidados.',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    variant: 'success',
    onConfirm: () => {},
    onClose: () => {},
  },
  play: async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: /confirmar/i })
    await expect(btn).toBeVisible()
  },
}

export const SuccessWithSummary: Story = {
  args: {
    open: true,
    title: 'Liquidar todo',
    message: 'Se crearán las siguientes transferencias:',
    confirmLabel: 'Liquidar',
    cancelLabel: 'Cancelar',
    variant: 'success',
    onConfirm: () => {},
    onClose: () => {},
  },
  render: (args) => (
    <DsConfirmModal {...args}>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0' }}>Bob → Alice: €50.00</p>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0' }}>Carol → Alice: €50.00</p>
    </DsConfirmModal>
  ),
}
