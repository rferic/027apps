import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { GroupInfoDrawer } from './group-info-drawer'

const meta = {
  component: GroupInfoDrawer,
  tags: ['ai-generated'],
} satisfies Meta<typeof GroupInfoDrawer>

export default meta
type Story = StoryObj<typeof meta>

const mockMembers = [
  { displayName: 'Alice', role: 'admin' },
  { displayName: 'Bob', role: 'member' },
  { displayName: 'Charlie', role: 'member' },
]

const mockApps = [
  { slug: 'todo', name: 'Todo' },
  { slug: 'inspiration', name: 'Inspiration' },
]

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    groupName: 'Family',
    groupSlug: 'family',
    members: mockMembers,
    apps: mockApps,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Family')).toBeVisible()
    await expect(canvas.getByText('Alice')).toBeVisible()
    await expect(canvas.getByText('Todo')).toBeVisible()
  },
}

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    groupName: 'Family',
    groupSlug: 'family',
    members: mockMembers,
    apps: mockApps,
  },
  play: async ({ canvas }) => {
    // When closed, the drawer is in the DOM but has opacity-0 + pointer-events-none
    const heading = canvas.getByText('Family')
    await expect(heading).not.toBeVisible()
  },
}

export const EmptyMembersAndApps: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    groupName: 'Solo',
    groupSlug: 'solo',
    members: [],
    apps: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Solo')).toBeVisible()
  },
}
