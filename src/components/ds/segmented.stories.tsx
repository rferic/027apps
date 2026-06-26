import type { Meta, StoryObj } from '@storybook/react'
import { DsSegmented } from './segmented'
import { useState } from 'react'

const meta: Meta<typeof DsSegmented> = {
  title: 'Design System/Segmented',
  component: DsSegmented,
  tags: ['autodocs'],
  argTypes: {
    color: { control: 'color' },
  },
}

export default meta
type Story = StoryObj<typeof DsSegmented>

const defaultOptions = [
  { value: 'expenses', label: 'Expenses' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'all', label: 'All' },
]

export const Default: Story = {
  render: () => {
    const [val, setVal] = useState('expenses')
    return <DsSegmented options={defaultOptions} value={val} onChange={setVal} />
  },
}

export const WithColor: Story = {
  render: () => {
    const [val, setVal] = useState('a')
    return (
      <DsSegmented
        options={[
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ]}
        value={val}
        onChange={setVal}
        color="#8B5CF6"
      />
    )
  },
}

export const ThreeOptions: Story = {
  render: () => {
    const [val, setVal] = useState('middle')
    return (
      <DsSegmented
        options={[
          { value: 'left', label: 'Left' },
          { value: 'middle', label: 'Middle' },
          { value: 'right', label: 'Right' },
        ]}
        value={val}
        onChange={setVal}
      />
    )
  },
}
