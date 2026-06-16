import type { Preview } from '@storybook/nextjs-vite'
import '@/design-tokens.css'
import '@/app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F8F6F3' },
        { name: 'dark', value: '#12120E' },
      ],
    },
    a11y: {
      test: 'todo'
    }
  },
  decorators: [
    (Story) => (
      <div style={{ fontFamily: "'Sora', sans-serif", padding: '16px' }}>
        <Story />
      </div>
    ),
  ],
}

export default preview
