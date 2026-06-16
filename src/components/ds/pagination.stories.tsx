import type { Meta, StoryObj } from '@storybook/react'
import { DsPagination } from './pagination'
import { useState } from 'react'

const meta: Meta<typeof DsPagination> = {
  title: 'Design System/Pagination',
  component: DsPagination,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DsPagination>

export const Default: Story = {
  args: { page: 1, totalPages: 5 },
}

export const Middle: Story = {
  args: { page: 3, totalPages: 10 },
}

export const Interactive: Story = {
  render: () => {
    const [page, setPage] = useState(1)
    return <DsPagination page={page} totalPages={8} onChange={setPage} />
  },
}
