import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DsSkeleton } from './skeleton'

describe('DsSkeleton', () => {
  it('renders single skeleton by default', () => {
    const { container } = render(<DsSkeleton />)
    const wrapper = container.firstElementChild!
    expect(wrapper.children.length).toBe(2) // 1 item + 1 style
  })

  it('renders multiple items with count', () => {
    const { container } = render(<DsSkeleton count={3} />)
    const wrapper = container.firstElementChild!
    expect(wrapper.children.length).toBe(4) // 3 items + 1 style
  })

  it('applies custom height', () => {
    const { container } = render(<DsSkeleton height={32} />)
    const item = container.firstElementChild!.firstElementChild as HTMLDivElement
    expect(item.style.height).toBe('32px')
  })

  it('applies circle shape', () => {
    const { container } = render(<DsSkeleton circle height={40} />)
    const item = container.firstElementChild!.firstElementChild as HTMLDivElement
    expect(item.style.borderRadius).toBe('50%')
  })
})
