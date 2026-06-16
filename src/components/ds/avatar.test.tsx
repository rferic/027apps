import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsAvatar } from './avatar'

describe('DsAvatar', () => {
  it('renders children', () => {
    render(<DsAvatar>ER</DsAvatar>)
    expect(screen.getByText('ER')).toBeDefined()
  })

  it('applies custom size', () => {
    render(<DsAvatar size={48}>LG</DsAvatar>)
    const el = screen.getByText('LG')
    expect(el.style.width).toBe('48px')
    expect(el.style.height).toBe('48px')
  })

  it('applies custom color', () => {
    render(<DsAvatar color="red">RD</DsAvatar>)
    const el = screen.getByText('RD')
    expect(el.style.background).toBe('red')
  })
})
