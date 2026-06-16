import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsInput, DsTextarea } from './input'

describe('DsInput', () => {
  it('renders input element', () => {
    render(<DsInput placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeDefined()
  })

  it('renders label when provided', () => {
    render(<DsInput label="Name" />)
    expect(screen.getByText('Name')).toBeDefined()
  })

  it('renders error message', () => {
    render(<DsInput error="Required field" />)
    expect(screen.getByText('Required field')).toBeDefined()
  })

  it('forwards input props', () => {
    render(<DsInput defaultValue="Hello" />)
    const input = screen.getByDisplayValue('Hello') as HTMLInputElement
    expect(input).toBeDefined()
  })

  it('disables the input', () => {
    render(<DsInput disabled placeholder="Disabled" />)
    const input = screen.getByPlaceholderText('Disabled') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })
})

describe('DsTextarea', () => {
  it('renders textarea element', () => {
    render(<DsTextarea placeholder="Write here" />)
    expect(screen.getByPlaceholderText('Write here')).toBeDefined()
  })

  it('renders label when provided', () => {
    render(<DsTextarea label="Description" />)
    expect(screen.getByText('Description')).toBeDefined()
  })

  it('renders error message', () => {
    render(<DsTextarea error="Required" />)
    expect(screen.getByText('Required')).toBeDefined()
  })
})
