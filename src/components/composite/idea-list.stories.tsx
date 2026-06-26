import type { Meta, StoryObj } from '@storybook/react'
import { IdeaList, type IdeaItemData } from './idea-list'

const meta: Meta<typeof IdeaList> = {
  title: 'Composite/IdeaList',
  component: IdeaList,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof IdeaList>

const sampleIdeas: IdeaItemData[] = [
  { id: '1', title: 'App para recetas de cocina', type: 'new_app', votes: 12, comments: 5 },
  { id: '2', title: 'Recordatorio de riego plantas', type: 'improvement', votes: 8, comments: 3 },
]

export const Default: Story = {
  args: { items: sampleIdeas },
}

export const Empty: Story = {
  args: { items: [] },
}
