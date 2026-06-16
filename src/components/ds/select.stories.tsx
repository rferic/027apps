import type { Meta, StoryObj } from '@storybook/react'
import { DsSelect } from './select'
import { useState } from 'react'

const meta: Meta<typeof DsSelect> = {
  title: 'Design System/Select',
  component: DsSelect,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsSelect>

const options = [
  { value: 'hogar', label: '🏠 Hogar' },
  { value: 'nico', label: '👶 Nico' },
  { value: 'finanzas', label: '💰 Finanzas' },
]

export const Default: Story = {
  args: { options, placeholder: 'Categoría' },
}

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return <DsSelect options={options} value={value} onChange={setValue} label="Categoría" />
  },
}
