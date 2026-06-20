import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ConfirmDialog } from './confirm-dialog'

const meta = {
  component: ConfirmDialog,
  tags: ['ai-generated'],
  argTypes: {
    open: { control: 'boolean' },
    variant: { control: 'select', options: ['default', 'destructive'] },
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

// ConfirmDialog uses @base-ui/react Dialog.Portal which renders into document.body.
// Query via canvasElement.ownerDocument.body to reach portal content.

export const Default: Story = {
  args: {
    open: true,
    title: 'Delete item?',
    description: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    onConfirm: () => {},
    onOpenChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByText('Delete item?')).toBeVisible()
    await expect(body.getByRole('button', { name: /delete/i })).toBeVisible()
    await expect(body.getByRole('button', { name: /cancel/i })).toBeVisible()
  },
}

export const Destructive: Story = {
  args: {
    open: true,
    title: 'Remove user',
    description: 'They will lose all access.',
    confirmLabel: 'Remove',
    cancelLabel: 'Keep',
    variant: 'destructive',
    onConfirm: () => {},
    onOpenChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /remove/i })
    await expect(btn).toBeVisible()
  },
}

export const Loading: Story = {
  args: {
    open: true,
    title: 'Processing...',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    loading: true,
    onConfirm: () => {},
    onOpenChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /confirm/i })
    await expect(btn).toBeDisabled()
  },
}

export const WithCallback: Story = {
  args: {
    open: true,
    title: 'Confirm action',
    confirmLabel: 'Yes',
    cancelLabel: 'No',
    onConfirm: () => {},
    onOpenChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const btn = body.getByRole('button', { name: /yes/i })
    await userEvent.click(btn)
    await expect(btn).toBeVisible()
  },
}

export const CssCheck: Story = {
  args: {
    open: true,
    title: 'Theme check',
    confirmLabel: 'Submit',
    cancelLabel: 'Back',
    variant: 'destructive',
    onConfirm: () => {},
    onOpenChange: () => {},
  },
  play: async ({ canvasElement }) => {
    // Verify design-tokens.css + globals.css loaded by checking a CSS custom property
    const styles = getComputedStyle(canvasElement.ownerDocument.documentElement)
    // --color-brand is #9B1C1C (light) or #D45050 (dark) — proves design tokens are loaded
    const brand = styles.getPropertyValue('--color-brand').trim()
    await expect(brand).toBe('#9B1C1C')
    // Also verify --font-body is loaded
    const fontBody = styles.getPropertyValue('--font-body').trim()
    await expect(fontBody).toBe("'Sora', sans-serif")
  },
}
