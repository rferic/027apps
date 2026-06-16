import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsPagination } from './pagination'

describe('DsPagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(<DsPagination page={1} totalPages={1} onChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders page buttons', () => {
    render(<DsPagination page={1} totalPages={3} onChange={() => {}} />)
    expect(screen.getByLabelText('Page 1')).toBeDefined()
    expect(screen.getByLabelText('Page 2')).toBeDefined()
    expect(screen.getByLabelText('Page 3')).toBeDefined()
  })

  it('marks current page with aria-current', () => {
    render(<DsPagination page={2} totalPages={5} onChange={() => {}} />)
    const current = screen.getByLabelText('Page 2')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('disables prev button on first page', () => {
    render(<DsPagination page={1} totalPages={5} onChange={() => {}} />)
    const prev = screen.getByLabelText('Previous page') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
  })

  it('disables next button on last page', () => {
    render(<DsPagination page={5} totalPages={5} onChange={() => {}} />)
    const next = screen.getByLabelText('Next page') as HTMLButtonElement
    expect(next.disabled).toBe(true)
  })
})
