import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsAlert } from './alert'

describe('DsAlert', () => {
  it('renders children', () => {
    render(<DsAlert>Message</DsAlert>)
    expect(screen.getByText('Message')).toBeDefined()
  })

  it('renders all variants without error', () => {
    const variants = ['info', 'success', 'warning', 'error'] as const
    for (const v of variants) {
      const { unmount } = render(<DsAlert variant={v}>{v}</DsAlert>)
      expect(screen.getByText(v)).toBeDefined()
      unmount()
    }
  })

  it('shows dismiss button when onDismiss is provided', () => {
    render(<DsAlert onDismiss={() => {}}>Dismissible</DsAlert>)
    expect(screen.getByLabelText('Dismiss')).toBeDefined()
  })

  it('accepts custom icon', () => {
    render(<DsAlert icon="🎉">Custom</DsAlert>)
    expect(screen.getByText('🎉')).toBeDefined()
  })

  it('has role="alert"', () => {
    render(<DsAlert>Alert</DsAlert>)
    expect(screen.getByRole('alert')).toBeDefined()
  })
})
