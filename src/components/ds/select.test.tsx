import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DsSelect } from './select'

const options = [
  { value: 'es', label: 'Spanish' },
  { value: 'en', label: 'English' },
]

describe('DsSelect', () => {
  it('renders placeholder when no value', () => {
    render(<DsSelect options={options} placeholder="Choose..." />)
    expect(screen.getByText('Choose...')).toBeDefined()
  })

  it('renders selected option label', () => {
    render(<DsSelect options={options} value="es" />)
    expect(screen.getByText('Spanish')).toBeDefined()
  })

  it('renders label when provided', () => {
    render(<DsSelect options={options} label="Language" />)
    expect(screen.getByText('Language')).toBeDefined()
  })

  it('opens dropdown on click and selects option', () => {
    let val = ''
    render(<DsSelect options={options} onChange={(v) => { val = v }} />)
    fireEvent.click(screen.getByText('Seleccionar...'))
    fireEvent.click(screen.getByText('Spanish'))
    expect(val).toBe('es')
  })
})
