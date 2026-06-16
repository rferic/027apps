import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsTabs } from './tabs'

const tabs = [
  { id: 'tab1', label: 'First', content: <div>Content 1</div> },
  { id: 'tab2', label: 'Second', content: <div>Content 2</div> },
]

describe('DsTabs', () => {
  it('renders all tab labels', () => {
    render(<DsTabs tabs={tabs} />)
    expect(screen.getByText('First')).toBeDefined()
    expect(screen.getByText('Second')).toBeDefined()
  })

  it('shows content of default tab', () => {
    render(<DsTabs tabs={tabs} defaultTab="tab1" />)
    expect(screen.getByText('Content 1')).toBeDefined()
  })

  it('calls onChange when tab changes', () => {
    let changed = ''
    render(<DsTabs tabs={tabs} defaultTab="tab1" onChange={(id) => { changed = id }} />)
    screen.getByText('Second').click()
    expect(changed).toBe('tab2')
  })

  it('handles empty tabs array', () => {
    const { container } = render(<DsTabs tabs={[]} />)
    expect(container.textContent).toBe('')
  })
})
