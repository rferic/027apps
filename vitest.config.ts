import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.opencode/**', 'packages/**'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
