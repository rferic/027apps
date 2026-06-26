import type { Preview } from '@storybook/nextjs-vite'
import '@/design-tokens.css'
import '@/app/globals.css'
import { NextIntlClientProvider } from 'next-intl'
import { initialize, mswLoader } from 'msw-storybook-addon'
import { mswHandlers } from './msw-handlers'
import enMessages from '../src/i18n/messages/en.json'
import { AdminMobileProvider } from '../src/components/admin-mobile-context'

initialize({ onUnhandledRequest: 'bypass' })

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
    },
    msw: { handlers: mswHandlers },
  },
  loaders: [mswLoader],
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AdminMobileProvider>
          <div style={{ fontFamily: "'Sora', sans-serif", padding: '16px' }}>
            <Story />
          </div>
        </AdminMobileProvider>
      </NextIntlClientProvider>
    ),
  ],
}

export default preview
