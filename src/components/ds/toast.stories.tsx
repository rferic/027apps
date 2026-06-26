import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent } from 'storybook/test'
import { within } from 'storybook/test'
import { dsToast } from './toast'
import { DsButton } from './button'
import { Toaster } from '@/components/ui/sonner'

function ToastDemo() {
  return null
}

const meta: Meta<typeof ToastDemo> = {
  title: 'Design System/Toast',
  component: ToastDemo,
  tags: ['ai-generated'],
  parameters: {
    docs: {
      description: {
        component: '`dsToast` es una API funcional que envuelve sonner. Úsala así:\n\n```tsx\nimport { dsToast } from "@/components/ds/toast"\n\ndsToast.success("Operación completada")\ndsToast.error("Algo salió mal")\ndsToast.info("Aquí hay información")\ndsToast.warning("Cuidado con esto")\n```',
      },
    },
  },
  decorators: [
    (Story) => (
      <>
        <Toaster />
        <Story />
      </>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  render: () => (
    <DsButton color="#10B981" onClick={() => dsToast.success('Operación completada correctamente')}>
      Show success toast
    </DsButton>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /success/i })
    await userEvent.click(btn)
    const toast = await body.findByText('Operación completada correctamente')
    await expect(toast).toBeInTheDocument()
  },
}

export const Error: Story = {
  render: () => (
    <DsButton color="#EF4444" onClick={() => dsToast.error('Ha ocurrido un error inesperado')}>
      Show error toast
    </DsButton>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /error/i })
    await userEvent.click(btn)
    const toast = await body.findByText('Ha ocurrido un error inesperado')
    await expect(toast).toBeInTheDocument()
  },
}

export const Info: Story = {
  render: () => (
    <DsButton variant="secondary" onClick={() => dsToast.info('Recuerda guardar tus cambios antes de salir')}>
      Show info toast
    </DsButton>
  ),
}

export const Warning: Story = {
  render: () => (
    <DsButton variant="outline" onClick={() => dsToast.warning('Tu sesión expirará en 5 minutos')}>
      Show warning toast
    </DsButton>
  ),
}

export const Stacked: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <DsButton color="#10B981" onClick={() => {
        dsToast.success('Primer toast')
        setTimeout(() => dsToast.success('Segundo toast'), 50)
        setTimeout(() => dsToast.success('Tercer toast'), 100)
      }}>
        Stack 3 toasts
      </DsButton>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /stack/i })
    await userEvent.click(btn)
    await body.findByText('Primer toast')
    await body.findByText('Segundo toast')
    await body.findByText('Tercer toast')
  },
}

export const LongMessage: Story = {
  render: () => (
    <DsButton variant="secondary" onClick={() =>
      dsToast.info('Este es un mensaje de toast muy largo que demuestra cómo el componente maneja textos extensos sin romper el layout ni desbordar el contenedor, manteniendo la legibilidad y el espaciado adecuado en todo momento.')
    }>
      Show long message
    </DsButton>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /long/i })
    await userEvent.click(btn)
    const toast = await body.findByText(/mensaje de toast muy largo/)
    await expect(toast).toBeInTheDocument()
  },
}
