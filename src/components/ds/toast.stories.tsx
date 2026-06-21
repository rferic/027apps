import type { Meta, StoryObj } from '@storybook/react'
import { dsToast } from './toast'
import { DsButton } from './button'
import { Toaster } from '@/components/ui/sonner'

const meta: Meta = {
  title: 'Design System/Toast',
  tags: ['autodocs'],
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

export const Variants: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <DsButton onClick={() => dsToast.success('Operación completada')}>Success</DsButton>
      <DsButton onClick={() => dsToast.error('Algo salió mal')}>Error</DsButton>
      <DsButton onClick={() => dsToast.info('Información importante')}>Info</DsButton>
      <DsButton onClick={() => dsToast.warning('Cuidado')}>Warning</DsButton>
    </div>
  ),
}
