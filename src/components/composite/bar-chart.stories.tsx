import type { Meta, StoryObj } from '@storybook/react'
import { BarChart } from './bar-chart'

const meta: Meta<typeof BarChart> = {
  title: 'Composite/BarChart',
  component: BarChart,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof BarChart>

const weekData = [
  { label: 'L', value: 4 },
  { label: 'M', value: 7 },
  { label: 'X', value: 3 },
  { label: 'J', value: 8 },
  { label: 'V', value: 5 },
  { label: 'S', value: 9 },
  { label: 'D', value: 2 },
]

export const Default: Story = {
  args: { data: weekData },
}

export const Highlighted: Story = {
  args: { data: weekData, highlightIndex: 5 },
}

export const WithLine: Story = {
  args: { data: weekData, showLine: true, color: '#10B981', height: 160 },
}
