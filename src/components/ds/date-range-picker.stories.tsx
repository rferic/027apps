import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'
import { DateRangePicker } from './date-range-picker'

const meta = {
  component: DateRangePicker,
  tags: ['ai-generated'],
} satisfies Meta<typeof DateRangePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { from: '', to: '', onFromChange: () => {}, onToChange: () => {} },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Seleccionar fechas')).toBeVisible()
  },
}

export const WithDates: Story = {
  args: { from: '2024-06-01', to: '2024-06-30', onFromChange: () => {}, onToChange: () => {} },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/1 jun → 30 jun/i)).toBeVisible()
  },
}

export const OpenCalendar: Story = {
  args: { from: '', to: '', onFromChange: () => {}, onToChange: () => {} },
  play: async ({ canvas, canvasElement, userEvent: ue }) => {
    const btn = canvas.getByText('Seleccionar fechas')
    await ue.click(btn)
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByText('OK')).toBeVisible()
  },
}
