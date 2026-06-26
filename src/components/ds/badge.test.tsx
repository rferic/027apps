import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsBadge } from './badge'

describe('DsBadge', () => {
  it('renders children', () => {
    render(<DsBadge>Test</DsBadge>)
    expect(screen.getByText('Test')).toBeDefined()
  })

  it('renders all variants without error', () => {
    const variants = ['primary', 'success', 'warning', 'error', 'neutral', 'outline'] as const
    for (const v of variants) {
      const { unmount } = render(<DsBadge variant={v}>{v}</DsBadge>)
      expect(screen.getByText(v)).toBeDefined()
      unmount()
    }
  })
})
