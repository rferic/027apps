import type { Meta, StoryObj } from '@storybook/react'
import { DsTable } from './table'
import { DsBadge } from './badge'
import { DsAvatar } from './avatar'

const meta: Meta<typeof DsTable> = {
  title: 'Design System/Table',
  component: DsTable,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsTable>

interface UserRow {
  name: string
  email: string
  role: string
  status: string
}

const data: UserRow[] = [
  { name: 'Eric', email: 'eric@familia.com', role: 'Admin', status: 'active' },
  { name: 'María', email: 'maria@familia.com', role: 'Member', status: 'active' },
  { name: 'Nico', email: 'nico@familia.com', role: 'Member', status: 'pending' },
]

const columns = [
  { header: 'Name', accessor: (r: UserRow) => <div style={{display:'flex',alignItems:'center',gap:8}}><DsAvatar size={24}>{r.name[0]}</DsAvatar>{r.name}</div> },
  { header: 'Email', accessor: (r: UserRow) => r.email },
  { header: 'Role', accessor: (r: UserRow) => r.role },
  { header: 'Status', accessor: (r: UserRow) => <DsBadge variant={r.status === 'active' ? 'success' : 'warning'}>{r.status}</DsBadge> },
]

export const Default: Story = {
  args: { columns, data },
}

interface EmptyRow { name: string; role: string }

export const Empty: Story = {
  args: {
    columns: [
      { header: 'Name', accessor: (r: EmptyRow) => r.name },
      { header: 'Role', accessor: (r: EmptyRow) => r.role },
    ],
    data: [] as EmptyRow[],
  },
}

interface ManyRow { id: number; name: string; email: string; role: string }

export const ManyRows: Story = {
  args: {
    columns: [
      { header: 'ID', accessor: (r: ManyRow) => r.id },
      { header: 'Name', accessor: (r: ManyRow) => r.name },
      { header: 'Email', accessor: (r: ManyRow) => r.email },
      { header: 'Role', accessor: (r: ManyRow) => r.role },
    ],
    data: [
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'Admin' },
      { id: 2, name: 'Bob', email: 'bob@example.com', role: 'Member' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'Member' },
      { id: 4, name: 'Diana', email: 'diana@example.com', role: 'Member' },
      { id: 5, name: 'Eve', email: 'eve@example.com', role: 'Member' },
      { id: 6, name: 'Frank', email: 'frank@example.com', role: 'Admin' },
    ] as ManyRow[],
  },
}

interface ClickableRow { name: string; role: string }

export const Clickable: Story = {
  args: {
    columns: [
      { header: 'Name', accessor: (r: ClickableRow) => r.name },
      { header: 'Role', accessor: (r: ClickableRow) => r.role },
    ],
    data: [
      { name: 'Alice', role: 'Admin' },
      { name: 'Bob', role: 'Member' },
    ] as ClickableRow[],
    onRowClick: (row: ClickableRow) => alert(`Clicked ${row.name}`),
  },
}
