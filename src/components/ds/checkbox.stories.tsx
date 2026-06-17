import type { Meta, StoryObj } from '@storybook/react'
import { DsCheckbox } from './checkbox'

const meta: Meta<typeof DsCheckbox> = {
  title: 'Design System/Checkbox',
  component: DsCheckbox,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    color: { control: 'color' },
  },
}

export default meta
type Story = StoryObj<typeof DsCheckbox>

export const Default: Story = {
  args: { label: 'Option' },
}

export const Checked: Story = {
  args: { label: 'Selected', checked: true },
}

export const Disabled: Story = {
  args: { label: 'Disabled', disabled: true },
}

export const DisabledChecked: Story = {
  args: { label: 'Disabled checked', disabled: true, checked: true },
}

export const WithoutLabel: Story = {
  args: {},
}

export const CustomColor: Story = {
  args: { label: 'Emerald', color: '#10B981', checked: true },
}

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DsCheckbox label="Unchecked" />
      <DsCheckbox label="Checked" checked />
      <DsCheckbox label="Disabled" disabled />
      <DsCheckbox label="Disabled checked" disabled checked />
    </div>
  ),
}
