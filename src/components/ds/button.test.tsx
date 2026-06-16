import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsButton } from './button'

describe('DsButton', () => {
  it('renders children', () => {
    render(<DsButton>Click me</DsButton>)
    expect(screen.getByText('Click me')).toBeDefined()
  })

  it('renders all variants without error', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost'] as const
    for (const v of variants) {
      const { unmount } = render(<DsButton variant={v}>{v}</DsButton>)
      expect(screen.getByText(v)).toBeDefined()
      unmount()
    }
  })

  it('renders all sizes without error', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    for (const s of sizes) {
      const { unmount } = render(<DsButton size={s}>{s}</DsButton>)
      expect(screen.getByText(s)).toBeDefined()
      unmount()
    }
  })

  it('forwards click events', () => {
    let clicked = false
    render(<DsButton onClick={() => { clicked = true }}>Click</DsButton>)
    screen.getByText('Click').click()
    expect(clicked).toBe(true)
  })

  it('disables the button', () => {
    render(<DsButton disabled>Disabled</DsButton>)
    const btn = screen.getByText('Disabled') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
