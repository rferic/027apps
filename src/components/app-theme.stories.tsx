import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import AppTheme from './app-theme'

const meta = {
  component: AppTheme,
  tags: ['ai-generated'],
  argTypes: {
    primaryColor: { control: 'color' },
    secondaryColor: { control: 'color' },
    scope: { control: 'select', options: ['global', 'local'] },
  },
} satisfies Meta<typeof AppTheme>

export default meta
type Story = StoryObj<typeof meta>

export const GlobalScope: Story = {
  args: {
    primaryColor: '#4F46E5',
    secondaryColor: '#EEF2FF',
    scope: 'global',
  },
  render: (args) => (
    <AppTheme {...args}>
      <div
        data-testid="themed-box"
        style={{
          padding: 16,
          background: 'var(--app-primary)',
          color: 'white',
          borderRadius: 8,
        }}
      >
        Themed container
      </div>
    </AppTheme>
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByTestId('themed-box')
    await expect(box).toBeVisible()
    // --app-primary should be set by AppTheme
    const bg = getComputedStyle(box).backgroundColor
    await expect(bg).toBe('rgb(79, 70, 229)')
  },
}

export const LocalScope: Story = {
  args: {
    primaryColor: '#10B981',
    secondaryColor: '#ECFDF5',
    scope: 'local',
  },
  render: (args) => (
    <AppTheme {...args}>
      <div
        data-testid="local-box"
        style={{
          padding: 16,
          border: '2px solid var(--app-primary)',
          borderRadius: 8,
          color: 'var(--color-text)',
        }}
      >
        Local scope
      </div>
    </AppTheme>
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByTestId('local-box')
    await expect(box).toBeVisible()
    const border = getComputedStyle(box).borderColor
    await expect(border).toBe('rgb(16, 185, 129)')
  },
}

export const MultipleThemes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <AppTheme primaryColor="#4F46E5" secondaryColor="#EEF2FF" scope="local">
        <div
          data-testid="blue-box"
          style={{
            padding: 12,
            background: 'var(--app-primary)',
            color: 'white',
            borderRadius: 6,
          }}
        >
          Blue
        </div>
      </AppTheme>
      <AppTheme primaryColor="#F59E0B" secondaryColor="#FFFBEB" scope="local">
        <div
          data-testid="amber-box"
          style={{
            padding: 12,
            background: 'var(--app-primary)',
            color: 'white',
            borderRadius: 6,
          }}
        >
          Amber
        </div>
      </AppTheme>
    </div>
  ),
}
