import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsCard } from './card'

describe('DsCard', () => {
  it('renders children', () => {
    render(<DsCard>Content</DsCard>)
    expect(screen.getByText('Content')).toBeDefined()
  })

  it('applies default padding (md)', () => {
    render(<DsCard>Card</DsCard>)
    const card = screen.getByText('Card')
    expect(card.style.padding).toBe('20px')
  })

  it('applies sm padding', () => {
    render(<DsCard padding="sm">Small</DsCard>)
    const card = screen.getByText('Small')
    expect(card.style.padding).toBe('16px')
  })

  it('applies lg padding', () => {
    render(<DsCard padding="lg">Large</DsCard>)
    const card = screen.getByText('Large')
    expect(card.style.padding).toBe('28px')
  })

  it('has pointer cursor when hover is true', () => {
    render(<DsCard>Hover</DsCard>)
    const card = screen.getByText('Hover')
    expect(card.style.cursor).toBe('pointer')
  })

  it('does not have pointer cursor when hover is false', () => {
    render(<DsCard hover={false}>Static</DsCard>)
    const card = screen.getByText('Static')
    expect(card.style.cursor).toBe('')
  })
})
