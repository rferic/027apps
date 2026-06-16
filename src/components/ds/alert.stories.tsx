import type { Meta, StoryObj } from '@storybook/react'
import { DsAlert } from './alert'

const meta: Meta<typeof DsAlert> = {
  title: 'Design System/Alert',
  component: DsAlert,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'error', 'info'] },
  },
}

export default meta
type Story = StoryObj<typeof DsAlert>

export const Info: Story = {
  args: { children: 'This is an informational message.', variant: 'info' },
}

export const Success: Story = {
  args: { children: 'Task completed successfully!', variant: 'success' },
}

export const Warning: Story = {
  args: { children: 'Please review your settings before continuing.', variant: 'warning' },
}

export const Error: Story = {
  args: { children: 'Something went wrong. Please try again.', variant: 'error' },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DsAlert variant="info">This is an informational message.</DsAlert>
      <DsAlert variant="success">Task completed successfully!</DsAlert>
      <DsAlert variant="warning">Please review your settings.</DsAlert>
      <DsAlert variant="error">Something went wrong.</DsAlert>
    </div>
  ),
}

export const Dismissible: Story = {
  render: () => (
    <DsAlert variant="info" onDismiss={() => alert('Dismissed!')}>
      Click the X to dismiss this alert.
    </DsAlert>
  ),
}
