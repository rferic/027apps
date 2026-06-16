import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsEmptyState } from './empty-state'

describe('DsEmptyState', () => {
  it('renders title', () => {
    render(<DsEmptyState title="No items" />)
    expect(screen.getByText('No items')).toBeDefined()
  })

  it('renders description when provided', () => {
    render(<DsEmptyState title="Empty" description="There is nothing here" />)
    expect(screen.getByText('There is nothing here')).toBeDefined()
  })

  it('renders custom icon', () => {
    render(<DsEmptyState icon="🌟" title="Star" />)
    expect(screen.getByText('🌟')).toBeDefined()
  })

  it('renders action element', () => {
    render(<DsEmptyState title="Action" action={<button>Create</button>} />)
    expect(screen.getByText('Create')).toBeDefined()
  })
})
