import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './stat-card'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total" value="€150" />)
    expect(screen.getByText('Total')).toBeDefined()
    expect(screen.getByText('€150')).toBeDefined()
  })

  it('renders icon when provided', () => {
    render(<StatCard label="Income" value="€500" icon="💰" />)
    expect(screen.getByText('💰')).toBeDefined()
  })

  it('applies custom color', () => {
    render(<StatCard label="Debt" value="€50" color="#EF4444" />)
    const value = screen.getByText('€50')
    expect(value.style.color).toBe('rgb(239, 68, 68)')
  })
})
