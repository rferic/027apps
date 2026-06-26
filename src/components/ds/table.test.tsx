import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DsTable } from './table'

interface Row { [key: string]: unknown; name: string; age: number }

const columns = [
  { header: 'Name', accessor: (r: Row) => r.name },
  { header: 'Age', accessor: (r: Row) => r.age, align: 'right' as const },
]

const data: Row[] = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
]

describe('DsTable', () => {
  it('renders column headers', () => {
    render(<DsTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeDefined()
    expect(screen.getByText('Age')).toBeDefined()
  })

  it('renders data rows', () => {
    render(<DsTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('renders empty state when no data', () => {
    render(<DsTable columns={columns} data={[]} />)
    expect(screen.getByText('No data')).toBeDefined()
  })

  it('calls onRowClick when row is clicked', () => {
    let clicked: Row | undefined
    render(<DsTable columns={columns} data={data} onRowClick={(r) => { clicked = r }} />)
    screen.getByText('Alice').click()
    expect(clicked?.name).toBe('Alice')
  })
})
