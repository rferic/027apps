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
