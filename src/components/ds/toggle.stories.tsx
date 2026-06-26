import type { Meta, StoryObj } from '@storybook/react'
import { DsToggle } from './toggle'
import { useState } from 'react'

const meta: Meta<typeof DsToggle> = {
  title: 'Design System/Toggle',
  component: DsToggle,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsToggle>

export const Default: Story = {
  args: { label: 'Notifications' },
}

export const Checked: Story = {
  args: { label: 'Dark mode', checked: true },
}

export const Disabled: Story = {
  args: { label: 'Disabled', disabled: true },
}

export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)
    return <DsToggle label={`Toggle is ${checked ? 'ON' : 'OFF'}`} checked={checked} onChange={setChecked} />
  },
}
