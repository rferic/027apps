import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BarChart } from './bar-chart'

const data = [
  { label: 'Jan', value: 100 },
  { label: 'Feb', value: 50 },
]

describe('BarChart', () => {
  it('renders SVG element', () => {
    const { container } = render(<BarChart data={data} />)
    expect(container.querySelector('svg')).toBeDefined()
  })

  it('renders data labels', () => {
    const { container } = render(<BarChart data={data} />)
    const texts = container.querySelectorAll('text')
    const labels = Array.from(texts).map(t => t.textContent)
    expect(labels).toContain('Jan')
    expect(labels).toContain('Feb')
  })

  it('renders data values', () => {
    const { container } = render(<BarChart data={data} />)
    const texts = container.querySelectorAll('text')
    const values = Array.from(texts).map(t => t.textContent)
    expect(values).toContain('100')
    expect(values).toContain('50')
  })

  it('renders bars as rect elements', () => {
    const { container } = render(<BarChart data={data} />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBe(data.length)
  })
})
