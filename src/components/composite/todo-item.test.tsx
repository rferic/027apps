import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoItem, type TodoItemData } from './todo-item'

const item: TodoItemData = {
  id: '1',
  title: 'Buy milk',
  priority: 'high',
  category: 'Shopping',
  emoji: '🛒',
  due: 'Hoy',
  assignee: 'Alice',
  done: false,
}

describe('TodoItem', () => {
  it('renders item title', () => {
    render(<TodoItem item={item} />)
    expect(screen.getByText('Buy milk')).toBeDefined()
  })

  it('renders priority badge', () => {
    render(<TodoItem item={item} />)
    expect(screen.getByText('high')).toBeDefined()
  })

  it('renders category with emoji', () => {
    render(<TodoItem item={item} />)
    expect(screen.getByText(/Shopping/)).toBeDefined()
  })

  it('renders due date warning for Hoy', () => {
    render(<TodoItem item={item} />)
    expect(screen.getByText(/Hoy/)).toBeDefined()
  })

  it('renders assignee avatar', () => {
    render(<TodoItem item={item} />)
    expect(screen.getByText('A')).toBeDefined()
  })

  it('calls onClick when item clicked', () => {
    let id = ''
    render(<TodoItem item={item} onClick={(i) => { id = i }} />)
    screen.getByText('Buy milk').click()
    expect(id).toBe('1')
  })

  it('has checkbox role with aria-checked', () => {
    render(<TodoItem item={item} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeDefined()
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
  })

  it('has tabIndex on checkbox', () => {
    render(<TodoItem item={item} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.getAttribute('tabindex')).toBe('0')
  })

  it('calls onToggle on checkbox Enter key', () => {
    let id = ''
    render(<TodoItem item={item} onToggle={(i) => { id = i }} />)
    const checkbox = screen.getByRole('checkbox')
    checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(id).toBe('1')
  })

  it('calls onToggle on checkbox Space key', () => {
    let id = ''
    render(<TodoItem item={item} onToggle={(i) => { id = i }} />)
    const checkbox = screen.getByRole('checkbox')
    checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(id).toBe('1')
  })
})
