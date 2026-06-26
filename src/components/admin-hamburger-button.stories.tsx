import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { HamburgerButton } from './admin-hamburger-button'
import { AdminMobileProvider } from './admin-mobile-context'

const meta = {
  component: HamburgerButton,
  tags: ['ai-generated'],
  decorators: [
    (Story) => (
      <AdminMobileProvider>
        <Story />
      </AdminMobileProvider>
    ),
  ],
} satisfies Meta<typeof HamburgerButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAriaLabel: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: /open menu/i })
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-label', 'Open menu')
  },
}
