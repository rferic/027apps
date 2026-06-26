import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsToggle } from './toggle'

describe('DsToggle', () => {
  it('renders toggle with label', () => {
    render(<DsToggle label="Dark mode" />)
    expect(screen.getByText('Dark mode')).toBeDefined()
  })

  it('has switch role and aria-checked', () => {
    render(<DsToggle />)
    const btn = screen.getByRole('switch')
    expect(btn).toBeDefined()
    expect(btn.getAttribute('aria-checked')).toBe('false')
  })

  it('respects checked prop', () => {
    render(<DsToggle checked={true} />)
    const btn = screen.getByRole('switch')
    expect(btn.getAttribute('aria-checked')).toBe('true')
  })

  it('toggles when clicked', () => {
    let checked = false
    render(<DsToggle onChange={(v) => { checked = v }} />)
    screen.getByRole('switch').click()
    expect(checked).toBe(true)
  })

  it('does not toggle when disabled', () => {
    let checked = false
    render(<DsToggle disabled onChange={(v) => { checked = v }} />)
    screen.getByRole('switch').click()
    expect(checked).toBe(false)
  })
})
