import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoList } from './todo-list'
import type { TodoItemData } from './todo-item'

const items: TodoItemData[] = [
  { id: '1', title: 'Task 1', priority: 'high', category: 'Work', emoji: '💼', due: 'Hoy', assignee: 'Alice', done: false },
  { id: '2', title: 'Task 2', priority: 'low', category: 'Home', emoji: '🏠', due: 'Mañana', assignee: 'Bob', done: true },
]

describe('TodoList', () => {
  it('renders title', () => {
    render(<TodoList items={items} title="My Tasks" />)
    expect(screen.getByText('My Tasks')).toBeDefined()
  })

  it('renders todo items', () => {
    render(<TodoList items={items} />)
    expect(screen.getByText('Task 1')).toBeDefined()
    expect(screen.getByText('Task 2')).toBeDefined()
  })

  it('shows new button when onNew provided', () => {
    render(<TodoList items={items} onNew={() => {}} />)
    expect(screen.getByText('+ Nueva')).toBeDefined()
  })

  it('shows empty message when no items', () => {
    render(<TodoList items={[]} />)
    expect(screen.getByText('No hay tareas pendientes')).toBeDefined()
  })

  it('shows view all link when onViewAll provided', () => {
    render(<TodoList items={items} onViewAll={() => {}} />)
    expect(screen.getByText('Ver todas →')).toBeDefined()
  })
})
