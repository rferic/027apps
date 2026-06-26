import type { Meta, StoryObj } from '@storybook/react'
import { DsInput, DsTextarea } from './input'

const meta: Meta<typeof DsInput> = {
  title: 'Design System/Input',
  component: DsInput,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof DsInput>

export const Default: Story = {
  args: { placeholder: 'Escribe algo...' },
}

export const WithLabel: Story = {
  args: { label: 'Email', placeholder: 'hola@ejemplo.com' },
}

export const WithError: Story = {
  args: { label: 'Email', placeholder: 'hola@ejemplo.com', error: 'Email no válido' },
}

export const Disabled: Story = {
  args: { placeholder: 'Deshabilitado', disabled: true },
}

export const TextareaStory: StoryObj<typeof DsTextarea> = {
  name: 'Textarea',
  render: () => <DsTextarea label="Descripción" placeholder="Escribe aquí..." rows={4} />,
}
